/**
 * Sobe e derruba o ambiente de desenvolvimento do Zovic.
 *
 *   bun start                                   → pergunta o ambiente, se é o primeiro acesso e o seed
 *   bun start backend [--first] [--seed=local]  → pula as perguntas (--seed=local ou --seed=prod)
 *   bun stop                                    → derruba todos os containers (o banco continua salvo)
 */
import * as p from "@clack/prompts";
import { $, type ShellPromise } from "bun";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

type Env = "backend" | "frontend" | "full";

/** Seed do banco: nenhum, LOCAL (dados de teste) ou PROD (só os dados reais). Ver docs/banco-de-dados.md. */
type Seed = "none" | "local" | "prod";

interface EnvPlan {
  /** Projetos que precisam de `bun install` local, além da raiz. */
  installs: string[];
  /** Argumentos do `docker compose` que sobem este ambiente. */
  compose: string[];
  /** O que fazer depois que o Docker subir. */
  next: string[];
}

const PLANS: Record<Env, EnvPlan> = {
  backend: {
    installs: ["api"],
    compose: ["up", "-d"],
    next: ["Em outro terminal: cd api && bun dev", "API em http://localhost:3333"],
  },
  frontend: {
    installs: ["frontend"],
    compose: ["--profile", "frontend", "up", "-d", "--build"],
    next: ["Em outro terminal: cd frontend && bun dev", "Frontend em http://localhost:3000"],
  },
  full: {
    installs: ["api", "frontend"],
    compose: ["--profile", "full", "up", "-d", "--build"],
    next: ["Frontend em http://localhost:3000", "API em http://localhost:3333"],
  },
};

const ROOT = join(import.meta.dir, "..");
const API = join(ROOT, "api");
$.cwd(ROOT);

/** Encerra com mensagem amigável quando o usuário aperta Ctrl+C num prompt. */
function orExit<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelado.");
    process.exit(0);
  }
  return value as T;
}

async function ensureDocker() {
  const docker = await $`docker info`.quiet().nothrow();
  if (docker.exitCode !== 0) {
    p.log.error("O Docker não está rodando. Abra o OrbStack (ou Docker Desktop) e tente de novo.");
    process.exit(1);
  }
}

function warnBunVersion() {
  const expected = pkg.packageManager.replace("bun@", "");
  if (Bun.version !== expected) {
    p.log.warn(`Bun ${Bun.version} instalado; o projeto usa ${expected}.`);
  }
}

/** Roda um comando com spinner; se falhar, mostra a saída e encerra. */
async function step(label: string, done: string, command: ShellPromise) {
  const s = p.spinner();
  s.start(label);
  const result = await command.quiet().nothrow();
  if (result.exitCode !== 0) {
    s.stop(`Falhou: ${label}`, 1);
    console.error(result.stdout.toString() + result.stderr.toString());
    process.exit(result.exitCode);
  }
  s.stop(done);
}

async function firstAccess(plan: EnvPlan) {
  if (!existsSync(join(ROOT, ".env"))) {
    copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env"));
    p.log.success(".env criado a partir do .env.example");
  }

  for (const dir of [".", ...plan.installs]) {
    const name = dir === "." ? "raiz" : `${dir}/`;
    await step(`bun install em ${name}`, `Dependências instaladas em ${name}`, $`bun install`.cwd(join(ROOT, dir)));
  }

  if (plan.installs.includes("api")) {
    await step("Gerando o client do Prisma em api/", "Client do Prisma gerado em api/", $`bun run db:generate`.cwd(API));
  }
}

async function migrationsSucceeded() {
  for (let i = 0; i < 240; i++) {
    const out = await $`docker compose ps -a --format {{.State}}:{{.ExitCode}} flyway`.quiet().nothrow();
    const [state, code] = out.stdout.toString().trim().split(":");
    if (state === "exited") return code === "0";
    await Bun.sleep(500);
  }
  return false;
}

async function seedDatabase(seed: Exclude<Seed, "none">) {
  const s = p.spinner();
  s.start("Esperando as migrations do Flyway");
  if (!(await migrationsSucceeded())) {
    s.stop("As migrations falharam; o seed não rodou. Veja: docker compose logs flyway", 1);
    process.exit(1);
  }
  s.stop("Migrations aplicadas");

  // O seed roda pela api/, que pode não ter sido instalada (ex.: ambiente frontend).
  if (!existsSync(join(API, "node_modules"))) {
    await step("bun install em api/ (necessário para o seed)", "Dependências instaladas em api/", $`bun install`.cwd(API));
  }
  if (!existsSync(join(API, "generated/prisma"))) {
    await step("Gerando o client do Prisma em api/", "Client do Prisma gerado em api/", $`bun run db:generate`.cwd(API));
  }

  p.log.step(`bun run db:seed --env=${seed}`);
  const result = await $`bun run db:seed --env=${seed}`.cwd(API).nothrow();
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

function seedFromArgs(args: string[]): Seed | undefined {
  const arg = args.find((a) => a.startsWith("--seed="));
  if (!arg) return undefined;
  const value = arg.slice("--seed=".length);
  if (value !== "local" && value !== "prod") {
    p.log.error(`--seed inválido: "${value}". Use --seed=local ou --seed=prod.`);
    process.exit(1);
  }
  return value;
}

async function start(args: string[]) {
  p.intro("Zovic · dev bros");

  const fromArgs = args.find((a): a is Env => a in PLANS);

  const env = fromArgs ?? orExit(
    await p.select<Env>({
      message: "Cê vai fazer o que, Zé?",
      showInstructions: false,
      options: [
        { value: "frontend", label: "frontend", hint: "Docker: banco + migrations + API" },
        { value: "backend", label: "backend", hint: "Docker: banco + migrations" },
        { value: "full", label: "full", hint: "Docker: o sistema inteiro" },
      ],
    }),
  );

  const isFirst = fromArgs
    ? args.includes("--first")
    : orExit(
        await p.confirm({
          message: "É o seu primeiro acesso?",
          active: "Sim",
          inactive: "Não",
          initialValue: false,
        }),
      );

  const seed = seedFromArgs(args) ?? (fromArgs
    ? "none"
    : orExit(
        await p.select<Seed>({
          message: "Quer popular o banco?",
          showInstructions: false,
          initialValue: isFirst ? "local" : "none",
          options: [
            { value: "none", label: "Não", hint: "mantém os dados que já estão no banco" },
            { value: "local", label: "LOCAL: dados de teste", hint: "apaga o banco local e insere tudo de novo" },
            { value: "prod", label: "PROD: só os dados reais", hint: "tipos de plano e gêneros, sem apagar nada" },
          ],
        }),
      ));

  const plan = PLANS[env];

  warnBunVersion();
  await ensureDocker();
  if (isFirst) await firstAccess(plan);

  p.log.step(`docker compose ${plan.compose.join(" ")}`);
  await $`docker compose ${plan.compose}`;

  if (seed !== "none") await seedDatabase(seed);

  p.note(plan.next.join("\n"), "Próximos passos");
  p.outro("Para parar: bun stop");
}

async function stop() {
  p.intro("Zovic · parando o ambiente");
  await ensureDocker();
  // --profile full inclui todos os serviços, qualquer que tenha sido o ambiente.
  await $`docker compose --profile full down`;
  p.outro("Containers parados. O banco continua salvo no volume.");
}

const [command = "start", ...rest] = process.argv.slice(2);

try {
  if (command === "stop") await stop();
  else await start(rest);
} catch (err) {
  // Erros do Bun Shell já imprimiram a saída do comando; basta o resumo.
  const exitCode = (err as { exitCode?: number }).exitCode ?? 1;
  p.log.error(`Falhou (código ${exitCode}). Veja a saída acima.`);
  process.exit(exitCode);
}
