/**
 * Sincroniza o prisma/schema.prisma com o banco, cuja estrutura é do Flyway.
 *
 *   bun run db:sync           → reescreve o schema a partir do banco, formata e gera o client
 *   bun run db:sync --check   → só confere; sai com erro se o schema estiver diferente do banco
 *
 * O `prisma db pull` faz a leitura e preserva o que já está no arquivo (nomes
 * renomeados com @map/@@map e comentários `///`). Este script acrescenta o que
 * o pull não faz: tira a tabela do Flyway, converte tabelas e colunas novas
 * para o padrão do projeto (models em PascalCase, campos em camelCase) e põe o
 * cabeçalho fixo de volta, já que o pull apaga comentários `//`.
 */
import { $ } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = join(import.meta.dir, "..");
const SCHEMA = join(API, "prisma/schema.prisma");

const HEADER = `// Zovic — schema Prisma, gerado por \`bun run db:sync\` a partir do banco.
//
// A estrutura do banco é do Flyway (db/migrations): não use \`prisma migrate\` nem
// \`db push\`. Depois de uma migration nova, rode \`bun run db:sync\`.
//
// Pode editar à mão nomes de models, campos e relações e comentários \`///\`: o
// db:sync preserva. Comentários \`//\` são apagados a cada sync.
//
// Ficam só no SQL, porque o Prisma não os representa: os CHECKs (preço >= 0,
// rating 1..5, streams >= 0, cor #RRGGBB, linha única de system_data…).
//
// previewFeatures "partialIndexes": representa os índices únicos parciais
// (WHERE deleted_at IS NULL) de genre.name e rating.
`;

/** Tabelas do banco que não entram no schema. */
const IGNORED_MODELS = ["flyway_schema_history"];

const pascal = (name: string) => name.split("_").filter(Boolean).map((p) => p[0]!.toUpperCase() + p.slice(1)).join("");
const camel = (name: string) => {
  const p = pascal(name);
  return p[0]!.toLowerCase() + p.slice(1);
};
const isConventional = (name: string, upperFirst: boolean) =>
  (upperFirst ? /^[A-Z][A-Za-z0-9]*$/ : /^[a-z][A-Za-z0-9]*$/).test(name);

/** Renomeia os identificadores de uma lista como `a, b` (dentro de `[...]`). */
const renameList = (list: string, names: Map<string, string> | undefined) =>
  list.replace(/\w+/g, (id) => names?.get(id) ?? id);

interface Block {
  kind: "model" | "enum";
  name: string;
  body: string[];
}

const BLOCK = /^(model|enum) (\w+) \{\n([\s\S]*?)^\}\n?/gm;
const FIELD = /^(\s+)(\w+)(\s+)(\w+)(\?|\[\])?(.*)$/;

/** Ajusta a saída do `prisma db pull` ao padrão do projeto. Exportada para teste. */
export function conform(schema: string): { schema: string; renamed: string[] } {
  const renamed: string[] = [];

  for (const name of IGNORED_MODELS) {
    schema = schema.replace(new RegExp(`^model ${name} \\{\\n[\\s\\S]*?^\\}\\n*`, "m"), "");
  }

  const blocks: Block[] = [...schema.matchAll(BLOCK)].map((m) => ({
    kind: m[1] === "enum" ? "enum" : "model",
    name: m[2]!,
    body: m[3]!.replace(/\n$/, "").split("\n"),
  }));

  // 1º passo: novos nomes de models/enums e, por model, dos campos.
  const typeNames = new Map<string, string>();
  for (const b of blocks) {
    typeNames.set(b.name, isConventional(b.name, true) ? b.name : pascal(b.name));
  }
  const isModel = (type: string) => blocks.some((block) => block.kind === "model" && block.name === type);

  const fieldNames = new Map<string, Map<string, string>>();
  for (const b of blocks.filter((block) => block.kind === "model")) {
    const names = new Map<string, string>();
    const taken = new Set<string>();
    for (const line of b.body) {
      const m = FIELD.exec(line);
      if (m) taken.add(m[2]!);
    }
    for (const line of b.body) {
      const m = FIELD.exec(line);
      if (!m || isConventional(m[2]!, false)) continue;
      const next = camel(m[2]!);
      if (taken.has(next)) {
        renamed.push(`${b.name}.${m[2]} mantido: já existe um campo ${next}`);
        continue;
      }
      names.set(m[2]!, next);
      taken.add(next);
    }
    fieldNames.set(b.name, names);
  }

  // 2º passo: reescreve cada bloco.
  const rewritten = new Map<string, string>();
  for (const b of blocks) {
    const newName = typeNames.get(b.name)!;
    const own = fieldNames.get(b.name);
    const body = b.body.map((line) => {
      const m = b.kind === "model" ? FIELD.exec(line) : null;
      if (!m) {
        // @@id([...]), @@index([...]), @@unique([...]): nomes de campos deste model.
        return line.replace(/^(\s+@@(?:id|index|unique)\(\[)([^\]]*)\]/, (_, head, list) => `${head}${renameList(list, own)}]`);
      }
      const [, indent, field, gap, type, modifier = "", rest] = m;
      const newField = own?.get(field!) ?? field!;
      const newType = typeNames.get(type!) ?? type!;
      let attrs = rest!;
      if (isModel(type!)) {
        // Relação: os campos locais (fields) são deste model; references, do outro.
        attrs = attrs
          .replace(/fields: \[([^\]]*)\]/, (_, list) => `fields: [${renameList(list, own)}]`)
          .replace(/references: \[([^\]]*)\]/, (_, list) => `references: [${renameList(list, fieldNames.get(type!))}]`);
      } else if (newField !== field && !attrs.includes("@map(")) {
        attrs = `${attrs} @map("${field}")`;
      }
      if (newField !== field) renamed.push(`${b.name}.${field} → ${newField}`);
      return `${indent}${newField}${gap}${newType}${modifier}${attrs}`;
    });
    if (newName !== b.name) {
      renamed.push(`${b.kind} ${b.name} → ${newName}`);
      if (!body.some((l) => l.trim().startsWith("@@map("))) body.push(`\n  @@map("${b.name}")`);
    }
    rewritten.set(b.name, `${b.kind} ${newName} {\n${body.join("\n")}\n}\n`);
  }

  schema = schema.replace(BLOCK, (_, _kind, name: string) => rewritten.get(name)!);

  // O pull apaga os comentários `//`: o cabeçalho volta sempre igual.
  schema = HEADER + "\n" + schema.replace(/^(\/\/[^\n]*\n|\s*\n)*/, "");
  return { schema, renamed };
}

async function prisma(args: string[]) {
  const result = await $`bunx prisma ${args}`.cwd(API).quiet().nothrow();
  if (result.exitCode !== 0) {
    const out = result.stdout.toString() + result.stderr.toString();
    if (/P1001|Can't reach database/.test(out)) {
      console.error("Não consegui conectar no banco. Ele está no ar? Na raiz: docker compose up");
    } else {
      console.error(out.trim());
    }
    process.exit(1);
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const dir = mkdtempSync(join(tmpdir(), "zovic-db-sync-"));
  const draft = join(dir, "schema.prisma");

  try {
    // O pull trabalha numa cópia: o arquivo real só muda se tudo der certo.
    await Bun.write(draft, Bun.file(SCHEMA));
    await prisma(["db", "pull", "--schema", draft]);
    const { schema, renamed } = conform(await Bun.file(draft).text());
    await Bun.write(draft, schema);
    await prisma(["format", "--schema", draft]);

    const current = await Bun.file(SCHEMA).text();
    const next = await Bun.file(draft).text();

    if (check) {
      if (current === next) {
        console.log("schema.prisma está igual ao banco.");
        return;
      }
      console.error("schema.prisma está diferente do banco. Rode `bun run db:sync`.\n");
      await $`git diff --no-index --color=always -- ${SCHEMA} ${draft}`.nothrow();
      process.exit(1);
    }

    if (current === next) {
      console.log("schema.prisma já estava igual ao banco.");
    } else {
      await Bun.write(SCHEMA, next);
      console.log("schema.prisma atualizado a partir do banco.");
      for (const line of renamed) console.log(`  ${line}`);
      if (renamed.length) console.log("  Nomes gerados automaticamente: renomeie à mão se quiser; o próximo sync mantém.");
    }

    await prisma(["generate"]);
    console.log("Client do Prisma gerado.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
