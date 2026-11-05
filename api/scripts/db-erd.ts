/**
 * Gera o diagrama ER do banco, sempre fiel às tabelas que existem nele.
 *
 *   bun run db:erd   → lê o banco do DATABASE_URL, escreve docs/assets/modelo-er-gerado.d2
 *                      e desenha docs/assets/modelo-er-gerado.svg
 *
 * O desenho é feito pelo D2 com o layout ELK, numa imagem Docker de versão fixa: sem Docker
 * o script falha. A saída é determinística, então o .d2 e o .svg só mudam quando o banco muda.
 * Depois de uma migration, rode e commite os dois arquivos.
 */
import { $ } from "bun";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../infra/db/pool.ts";

const ASSETS_DIR = join(import.meta.dir, "../../docs/assets");
const D2_FILE = "modelo-er-gerado.d2";
const SVG_FILE = "modelo-er-gerado.svg";
const D2_IMAGE = "terrastruct/d2:v0.9.0";
const D2_PADDING = 40;
/** Pasta do container onde o D2 lê e escreve os arquivos. */
const CONTAINER_DIR = "/work";

/**
 * Fora do diagrama: o histórico do Flyway é controle de migration, e as tabelas do Better Auth
 * (contas, sessões, tokens de verificação) são infraestrutura de login, não modelo de domínio.
 */
const EXCLUDED_TABLES = ["flyway_schema_history", "account", "session", "verification"];

/** Áreas do diagrama. Uma tabela nova precisa entrar numa delas, senão o script falha. */
const GROUPS: Record<string, { label: string; tables: string[] }> = {
  contas: { label: "Contas e planos", tables: ["user", "user_event", "plan_type", "plan", "plan_user", "plan_invitation"] },
  catalogo: {
    label: "Catálogo",
    tables: ["musics", "album", "artist", "genre", "album_music", "artist_music", "album_artist", "genre_music", "album_genre"],
  },
  playlists: { label: "Playlists", tables: ["playlists", "playlist_user", "music_playlist"] },
  interacoes: { label: "Interações", tables: ["comments", "rating", "music_user"] },
  sistema: { label: "Sistema", tables: ["system_data"] },
};

interface Column {
  table: string;
  name: string;
  type: string;
}

interface ForeignKey {
  childTable: string;
  parentTable: string;
  childColumns: string[];
  parentColumns: string[];
  isRequired: boolean;
  isUnique: boolean;
}

const isIncluded = (table: string) => !EXCLUDED_TABLES.includes(table);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Os tipos longos do Postgres poluem o desenho sem ajudar a ler o modelo. */
function shortType(type: string) {
  return type
    .replace("timestamp with time zone", "timestamptz")
    .replace("character varying", "varchar")
    .replace("double precision", "double");
}

const COLUMNS_QUERY = `
  SELECT c.relname AS "table", a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
   ORDER BY c.relname, a.attnum`;

const PRIMARY_KEYS_QUERY = `
  SELECT c.relname AS "table", a.attname AS name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
   WHERE n.nspname = 'public' AND con.contype = 'p'`;

/** `is_unique`: as colunas da FK são exatamente as de um índice único não parcial. */
const FOREIGN_KEYS_QUERY = `
  SELECT child.relname AS "childTable",
         parent.relname AS "parentTable",
         (SELECT array_agg(a.attname::text ORDER BY k.ord)
            FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS "childColumns",
         (SELECT array_agg(a.attname::text ORDER BY k.ord)
            FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum) AS "parentColumns",
         (SELECT bool_and(a.attnotnull)
            FROM pg_attribute a
           WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)) AS "isRequired",
         EXISTS (
           SELECT 1 FROM pg_index i
            WHERE i.indrelid = con.conrelid AND i.indisunique AND i.indpred IS NULL
              AND (SELECT array_agg(x ORDER BY x) FROM unnest(i.indkey::int2[]) x)
                = (SELECT array_agg(x ORDER BY x) FROM unnest(con.conkey) x)
         ) AS "isUnique"
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f'
   ORDER BY child.relname, con.conname`;

/**
 * Pé de galinha de cada ponta, lido do banco. O D2 só desenha a ponta de origem numa ligação
 * `<->` (com `->` a de destino fica de fora), então todas usam `<->` e as duas pontas são
 * escolhidas à mão.
 *   Filha: muitas linhas apontam para um pai (cf-many), ou no máximo uma se a FK é única (cf-one).
 *   Pai: exatamente um se a FK é NOT NULL (cf-one-required), ou zero ou um se aceita NULL (cf-one).
 */
function arrowheads(foreignKey: ForeignKey) {
  return {
    child: foreignKey.isUnique ? "cf-one" : "cf-many",
    parent: foreignKey.isRequired ? "cf-one-required" : "cf-one",
  };
}

function groupOf(table: string): string {
  const entry = Object.entries(GROUPS).find(([, group]) => group.tables.includes(table));
  if (!entry) fail(`A tabela "${table}" não está em nenhuma área do diagrama. Adicione-a a uma delas em GROUPS, em api/scripts/db-erd.ts.`);
  return entry[0];
}

function buildD2(columns: Column[], primaryKeys: Set<string>, foreignKeys: ForeignKey[]) {
  const foreignKeyColumns = new Set(foreignKeys.flatMap((fk) => fk.childColumns.map((column) => `${fk.childTable}.${column}`)));
  for (const table of new Set(columns.map((column) => column.table))) groupOf(table);
  const lines = ["direction: right", "vars: {d2-config: {layout-engine: elk}}", ""];

  for (const [key, group] of Object.entries(GROUPS)) {
    lines.push(`${key}: "${group.label}" {`);
    for (const table of group.tables) {
      const tableColumns = columns.filter((column) => column.table === table);
      if (tableColumns.length === 0) continue;
      lines.push(`  ${table}: {`, "    shape: sql_table");
      for (const column of tableColumns) {
        const id = `${table}.${column.name}`;
        const constraints = [primaryKeys.has(id) ? "primary_key" : "", foreignKeyColumns.has(id) ? "foreign_key" : ""].filter(Boolean);
        const suffix = constraints.length > 0 ? ` {constraint: [${constraints.join("; ")}]}` : "";
        lines.push(`    ${column.name}: "${shortType(column.type)}"${suffix}`);
      }
      lines.push("  }");
    }
    lines.push("}", "");
  }

  for (const foreignKey of foreignKeys) {
    const { child, parent } = arrowheads(foreignKey);
    const source = `${groupOf(foreignKey.childTable)}.${foreignKey.childTable}.${foreignKey.childColumns[0]}`;
    const target = `${groupOf(foreignKey.parentTable)}.${foreignKey.parentTable}.${foreignKey.parentColumns[0]}`;
    lines.push(`${source} <-> ${target}: {`, `  source-arrowhead.shape: ${child}`, `  target-arrowhead.shape: ${parent}`, "}");
  }
  return `${lines.join("\n")}\n`;
}

async function readSchema() {
  const [columns, primaryKeys, foreignKeys] = await Promise.all([
    pool.query<Column>(COLUMNS_QUERY),
    pool.query<{ table: string; name: string }>(PRIMARY_KEYS_QUERY),
    pool.query<ForeignKey>(FOREIGN_KEYS_QUERY),
  ]);
  return {
    columns: columns.rows.filter((column) => isIncluded(column.table)),
    primaryKeys: new Set(primaryKeys.rows.map((row) => `${row.table}.${row.name}`)),
    foreignKeys: foreignKeys.rows.filter((fk) => isIncluded(fk.childTable) && isIncluded(fk.parentTable)),
  };
}

async function drawSvg() {
  const docker = await $`docker version --format {{.Server.Version}}`.quiet().nothrow();
  if (docker.exitCode !== 0) fail("O Docker não está disponível. O db:erd usa a imagem do D2 (" + D2_IMAGE + "): inicie o Docker e rode de novo.");

  const user = `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
  const result =
    await $`docker run --rm --user ${user} -v ${ASSETS_DIR}:${CONTAINER_DIR} ${D2_IMAGE} --layout elk --pad ${D2_PADDING} ${CONTAINER_DIR}/${D2_FILE} ${CONTAINER_DIR}/${SVG_FILE}`
      .quiet()
      .nothrow();
  if (result.exitCode !== 0) fail(`O D2 falhou ao desenhar o diagrama:\n${result.stderr.toString()}`);
}

try {
  const { columns, primaryKeys, foreignKeys } = await readSchema();
  const d2 = buildD2(columns, primaryKeys, foreignKeys);
  mkdirSync(ASSETS_DIR, { recursive: true });
  writeFileSync(join(ASSETS_DIR, D2_FILE), d2);
  await drawSvg();
  console.log(`Gerados docs/assets/${D2_FILE} e docs/assets/${SVG_FILE}.`);
} finally {
  await pool.end();
}
