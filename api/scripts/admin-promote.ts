/**
 * Concede ou retira o papel de admin da plataforma (user.role).
 *
 *   bun run admin:promote <email>            → torna o usuário admin
 *   bun run admin:promote <email> --revoke   → volta o usuário a assinante
 *
 * Nenhuma rota da API muda o papel, então este script é o caminho para promover alguém.
 * Ele usa o DATABASE_URL do .env: confira para qual banco aponta antes de rodar.
 * Não retira o último admin ativo, para a plataforma não ficar sem nenhum.
 * A mudança vale na próxima requisição: a sessão lê o papel do banco a cada chamada.
 */
import { pool } from "../infra/db/pool.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
if (!email) fail("Uso: bun run admin:promote <email> [--revoke]");

const role = revoke ? "assinante" : "admin";
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ id: number; name: string; role: string; deleted_at: Date | null }>(
    `SELECT id, name, role, deleted_at FROM "user" WHERE email = $1 FOR UPDATE`,
    [email],
  );
  const user = rows[0];
  if (!user) fail(`Nenhum usuário com o email ${email}.`);
  if (user.deleted_at && !revoke) fail(`${email} tem soft delete e não pode virar admin.`);
  if (user.role === role) fail(`${user.name} <${email}> já é ${role}.`);

  if (revoke) {
    // Trava as linhas de admin para duas revogações simultâneas não deixarem a plataforma sem nenhum.
    const others = await client.query(
      `SELECT 1 FROM "user" WHERE role = 'admin' AND deleted_at IS NULL AND id <> $1 FOR UPDATE`,
      [user.id],
    );
    if (others.rowCount === 0) fail(`${email} é o último admin da plataforma e não pode perder o papel.`);
  }

  await client.query(`UPDATE "user" SET role = $1, updated_at = now() WHERE id = $2`, [role, user.id]);
  await client.query("COMMIT");
  console.log(`${user.name} <${email}>: ${user.role} → ${role}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
