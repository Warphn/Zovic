/**
 * Configuração do Prisma CLI.
 *
 * O schema do banco é do Flyway (db/migrations): aqui o Prisma só gera o client
 * tipado e roda o seed. Não use `prisma migrate` nem `db push`.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// O .env fica na raiz do repositório, não em api/. Carregá-lo aqui faz qualquer
// comando do Prisma funcionar (scripts, `bunx prisma …`, plugin da IDE). No
// Docker ele não existe e o DATABASE_URL vem do docker-compose.yml.
const rootEnv = fileURLToPath(new URL("../.env", import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
