/**
 * Popula o banco com os seeders de seeders.ts.
 *
 *   bun run db:seed              → banco local: apaga tudo e roda os seeders LOCAL e ALL
 *   bun run db:seed --env=prod   → produção: roda só os seeders PROD e ALL, sem apagar nada
 *
 * Tudo roda numa transação: se um seeder falhar, nada é gravado.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { seeders } from "./seeders.ts";
import type { SeedEnv, Tx } from "./support.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function targetEnv(): Exclude<SeedEnv, "ALL"> {
  const arg = process.argv.find((a) => a.startsWith("--env="));
  const value = (arg?.slice("--env=".length) ?? "local").toUpperCase();
  if (value !== "LOCAL" && value !== "PROD") fail(`--env inválido: "${value.toLowerCase()}". Use --env=local ou --env=prod.`);
  return value;
}

/** Mesmo .env da raiz que o `bun dev` e o prisma.config.ts usam. */
function databaseUrl(): URL {
  const rootEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (!process.env.DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL não definido. Crie o .env na raiz: cp .env.example .env");
  return new URL(url);
}

/** Esvazia todas as tabelas, menos o histórico do Flyway, e reinicia os ids. */
async function truncateAll(tx: Tx) {
  const tables = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await tx.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  const env = targetEnv();
  const url = databaseUrl();

  // Trava: o seed local apaga o banco inteiro, então só roda em localhost.
  if (env === "LOCAL" && !LOCAL_HOSTS.has(url.hostname)) {
    fail(`Recusado: o seed local apaga o banco, e o DATABASE_URL aponta para "${url.hostname}", não para localhost.`);
  }

  const selected = seeders.filter((seeder) => seeder.env === "ALL" || seeder.env === env);
  console.log(`Seed ${env} em ${url.hostname}:${url.port || 5432}${url.pathname}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    await prisma.$transaction(
      async (tx) => {
        if (env === "LOCAL") {
          await truncateAll(tx);
          console.log("  Banco limpo");
        }
        for (const seeder of selected) {
          console.log(`  ${seeder.name} [${seeder.env}]: ${await seeder.run(tx)}`);
        }
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
    console.log("Seed concluído.");
  } catch (error) {
    console.error(`Seed falhou; nada foi gravado.\n\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await main();
