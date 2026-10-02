/**
 * Sobe e derruba o ambiente de desenvolvimento do Zovic.
 *
 *   bun start                     → pergunta o ambiente e se é o primeiro acesso
 *   bun start backend [--first]   → pula as perguntas
 *   bun stop                      → derruba todos os containers (o banco continua salvo)
 */
import * as p from "@clack/prompts";
import { $ } from "bun";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

type Env = "backend" | "frontend" | "full";

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

async function firstAccess(plan: EnvPlan) {
  if (!existsSync(join(ROOT, ".env"))) {
    copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env"));
    p.log.success(".env criado a partir do .env.example");
  }

  for (const dir of [".", ...plan.installs]) {
    const name = dir === "." ? "raiz" : `${dir}/`;
    const s = p.spinner();
    s.start(`bun install em ${name}`);
    const result = await $`bun install`.cwd(join(ROOT, dir)).quiet().nothrow();
    if (result.exitCode !== 0) {
      s.stop(`bun install falhou em ${name}`, 1);
      console.error(result.stderr.toString());
      process.exit(result.exitCode);
    }
    s.stop(`Dependências instaladas em ${name}`);
  }
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

  const plan = PLANS[env];

  warnBunVersion();
  await ensureDocker();
  if (isFirst) await firstAccess(plan);

  p.log.step(`docker compose ${plan.compose.join(" ")}`);
  await $`docker compose ${plan.compose}`;

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
