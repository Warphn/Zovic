/**
 * Gerencia os usuários do Postgres da equipe, que acessam o banco de produção pelo Cloudflare Access.
 *
 *   bun run db:member add <nome>      → cria o usuário e mostra a senha uma única vez
 *   bun run db:member reset <nome>    → gera uma senha nova (a antiga deixa de valer)
 *   bun run db:member remove <nome>   → encerra as conexões e apaga o usuário
 *   bun run db:member list            → lista os usuários da equipe
 *
 * Todos entram no grupo `equipe`: leem e alteram dados de todas as tabelas, mas não mudam o
 * schema (quem muda é o Flyway). Ficam de fora as tabelas com segredos do Better Auth
 * (tokens de sessão, hashes de senha) e só a leitura do histórico do Flyway é liberada.
 * Ele usa o DATABASE_URL do .env: confira para qual banco aponta antes de rodar.
 */
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../infra/db/pool.ts";

const GROUP = "equipe";
/** Guardam tokens de sessão, hashes de senha e códigos de verificação: com elas, dá para entrar como qualquer usuário. */
const SECRET_TABLES = ["session", "account", "verification"];
/** Alterar o histórico faz o Flyway reaplicar ou pular migrations. */
const FLYWAY_HISTORY = "flyway_schema_history";
const NAME_PATTERN = /^[a-z][a-z0-9_]{1,30}$/;
const CONNECTION_LIMIT = 3;
/** Uma consulta esquecida rodando, ou uma transação aberta, não trava a API. */
const STATEMENT_TIMEOUT = "60s";
const IDLE_IN_TRANSACTION_TIMEOUT = "5min";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Cria o grupo e renova as permissões dele; roda a cada add, então cobre as tabelas criadas desde a última vez. */
async function grantGroup(client: PoolClient) {
  const group = client.escapeIdentifier(GROUP);
  const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [GROUP]);
  if (exists.rowCount === 0) await client.query(`CREATE ROLE ${group} NOLOGIN`);

  const { rows } = await client.query<{ db: string; owner: string }>(`SELECT current_database() AS db, current_user AS owner`);
  const current = rows[0];
  if (!current) throw new Error("current_database() não respondeu");
  const db = client.escapeIdentifier(current.db);
  // As tabelas futuras são criadas pelo Flyway, que entra com este mesmo usuário.
  const owner = client.escapeIdentifier(current.owner);

  await client.query(`GRANT CONNECT ON DATABASE ${db} TO ${group}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${group}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${group}`);
  await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${group}`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${group}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${group}`,
  );

  for (const table of SECRET_TABLES) {
    await client.query(`REVOKE ALL ON TABLE ${client.escapeIdentifier(table)} FROM ${group}`);
  }
  await client.query(`REVOKE INSERT, UPDATE, DELETE ON TABLE ${client.escapeIdentifier(FLYWAY_HISTORY)} FROM ${group}`);
}

async function isMember(client: PoolClient, name: string) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM pg_auth_members m
       JOIN pg_roles u ON u.oid = m.member
       JOIN pg_roles g ON g.oid = m.roleid
      WHERE u.rolname = $1 AND g.rolname = $2`,
    [name, GROUP],
  );
  return rowCount !== 0;
}

/** Hexadecimal: entra sem escape em qualquer string de conexão. */
function newPassword() {
  return randomBytes(24).toString("hex");
}

function printPassword(name: string, password: string) {
  console.log(`Usuário: ${name}`);
  console.log(`Senha:   ${password}`);
  console.log("Envie a senha à pessoa por um canal privado. Ela não é guardada em lugar nenhum e não aparece de novo.");
}

async function add(client: PoolClient, name: string) {
  const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [name]);
  if (exists.rowCount !== 0) fail(`Já existe um usuário ${name} no Postgres. Para trocar a senha: db:member reset ${name}`);

  const password = newPassword();
  const role = client.escapeIdentifier(name);
  await client.query("BEGIN");
  await grantGroup(client);
  await client.query(
    `CREATE ROLE ${role} LOGIN PASSWORD ${client.escapeLiteral(password)} CONNECTION LIMIT ${CONNECTION_LIMIT} IN ROLE ${client.escapeIdentifier(GROUP)}`,
  );
  await client.query(`ALTER ROLE ${role} SET statement_timeout = ${client.escapeLiteral(STATEMENT_TIMEOUT)}`);
  await client.query(
    `ALTER ROLE ${role} SET idle_in_transaction_session_timeout = ${client.escapeLiteral(IDLE_IN_TRANSACTION_TIMEOUT)}`,
  );
  await client.query("COMMIT");
  printPassword(name, password);
}

async function reset(client: PoolClient, name: string) {
  if (!(await isMember(client, name))) fail(`${name} não é um usuário da equipe.`);
  const password = newPassword();
  await client.query(`ALTER ROLE ${client.escapeIdentifier(name)} PASSWORD ${client.escapeLiteral(password)}`);
  printPassword(name, password);
}

async function remove(client: PoolClient, name: string) {
  if (!(await isMember(client, name))) fail(`${name} não é um usuário da equipe.`);
  await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1`, [name]);
  await client.query(`DROP ROLE ${client.escapeIdentifier(name)}`);
  console.log(`${name} removido. As conexões abertas foram encerradas.`);
}

async function list(client: PoolClient) {
  const { rows } = await client.query<{ name: string; connections: string }>(
    `SELECT u.rolname AS name, (SELECT count(*) FROM pg_stat_activity a WHERE a.usename = u.rolname) AS connections
       FROM pg_auth_members m
       JOIN pg_roles u ON u.oid = m.member
       JOIN pg_roles g ON g.oid = m.roleid
      WHERE g.rolname = $1
      ORDER BY u.rolname`,
    [GROUP],
  );
  if (rows.length === 0) console.log("Nenhum usuário da equipe ainda.");
  for (const row of rows) console.log(`${row.name} (${row.connections} conexões abertas)`);
}

const usage = "Uso: bun run db:member add|reset|remove <nome>  ou  bun run db:member list";

function parseName(value: string | undefined): string {
  if (!value || !NAME_PATTERN.test(value)) fail(`Nome inválido. Use letras minúsculas, números e _, começando por letra. ${usage}`);
  if (value === GROUP) fail(`"${GROUP}" é o nome do grupo, não de uma pessoa.`);
  return value;
}

const [command, arg] = process.argv.slice(2);
if (!["add", "reset", "remove", "list"].includes(command ?? "")) fail(usage);
const name = command === "list" ? "" : parseName(arg);

const client = await pool.connect();
try {
  if (command === "add") await add(client, name);
  else if (command === "reset") await reset(client, name);
  else if (command === "remove") await remove(client, name);
  else await list(client);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
