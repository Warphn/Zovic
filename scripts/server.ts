/**
 * Sobe e derruba o servidor de produção: banco, migrations, API e o túnel da Cloudflare (profile prod).
 * Roda no desktop, a partir do clone do Ubuntu (~/zovic), onde está o .env de produção.
 *
 *   bun server                   → menu
 *   bun server up                → sobe (ou aplica mudanças) e confere o endereço público
 *   bun server down              → derruba; os dados do banco continuam no volume
 *   bun server status            → estado dos containers e do endereço público
 *   bun server logs [serviço]    → acompanha os logs (Ctrl+C para sair)
 *   bun server update            → git pull e sobe a versão nova
 */
import * as p from "@clack/prompts";
import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Command = "up" | "down" | "status" | "logs" | "update";

const COMMANDS: Command[] = ["up", "down", "status", "logs", "update"];
const SERVICES = ["db", "flyway", "api", "cloudflared"];
const COMPOSE = ["--profile", "prod"];

/** Sem elas o banco não inicializa, o login não assina sessões ou o túnel não conecta. */
const REQUIRED_VARS = ["POSTGRES_PASSWORD", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "CLOUDFLARE_TUNNEL_TOKEN"];

const ROOT = join(import.meta.dir, "..");
const ENV_PATH = join(ROOT, ".env");
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
    p.log.error("O Docker não está rodando. Abra o Docker Desktop, espere o \"Engine running\" e tente de novo.");
    process.exit(1);
  }
}

/** Lê o .env da raiz sem mostrar nenhum valor. */
function readEnv(): Record<string, string> | null {
  if (!existsSync(ENV_PATH)) return null;
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

/** Recusa subir sem o .env de produção: sem ele o banco nasce sem senha e o túnel não conecta. */
function requireProdEnv(): Record<string, string> {
  const env = readEnv();
  if (!env) {
    p.log.error(`Não há .env em ${ROOT}. Rode no clone do servidor (~/zovic), onde está o .env de produção.`);
    process.exit(1);
  }
  const missing = REQUIRED_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    p.log.error(`Variáveis vazias no .env: ${missing.join(", ")}.`);
    process.exit(1);
  }
  if (env.COOKIE_SECURE !== "true") {
    p.log.warn("COOKIE_SECURE não está como true: o cookie de sessão vai sem o atributo Secure.");
  }
  return env;
}

/** Tenta o /health pelo endereço público, passando pela Cloudflare e pelo túnel. */
async function publicHealth(baseUrl: string, attempts: number) {
  const url = `${baseUrl}/health`;
  const s = p.spinner();
  s.start(`Testando ${url}`);
  for (let i = 0; i < attempts; i++) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
    if (ok) {
      s.stop(`${url} respondeu: a API está no ar.`);
      return;
    }
    if (i < attempts - 1) await Bun.sleep(3000);
  }
  s.stop(`${url} não respondeu. Veja: bun server logs cloudflared`, 1);
}

async function up() {
  const env = requireProdEnv();
  await ensureDocker();

  // --wait: só termina com db e api healthy, flyway concluído e cloudflared rodando.
  p.log.step(`docker compose ${COMPOSE.join(" ")} up -d --build --wait`);
  await $`docker compose ${COMPOSE} up -d --build --wait --wait-timeout 300`;

  // O túnel leva alguns segundos para registrar as conexões depois de o container subir.
  await publicHealth(env.BETTER_AUTH_URL, 10);
  p.outro("Servidor no ar. Para derrubar: bun server down");
}

async function down() {
  await ensureDocker();
  p.log.step(`docker compose ${COMPOSE.join(" ")} down`);
  await $`docker compose ${COMPOSE} down`;
  p.outro("Servidor fora do ar. O banco continua salvo no volume. Num reinício ele não volta sozinho: bun server up");
}

async function status() {
  await ensureDocker();
  await $`docker compose ${COMPOSE} ps -a`;
  const env = readEnv();
  if (env?.BETTER_AUTH_URL) await publicHealth(env.BETTER_AUTH_URL, 1);
  p.outro("db e api devem estar healthy, flyway Exited (0) e cloudflared Up.");
}

async function logs(service: string | undefined) {
  if (service && !SERVICES.includes(service)) {
    p.log.error(`Serviço inválido: "${service}". Use um de: ${SERVICES.join(", ")}.`);
    process.exit(1);
  }
  await ensureDocker();
  p.log.step("Ctrl+C para sair");
  // nothrow: o Ctrl+C encerra o docker compose logs com código diferente de zero.
  await $`docker compose ${COMPOSE} logs -f --tail 50 ${service ?? []}`.nothrow();
}

async function update() {
  requireProdEnv();
  const branch = (await $`git branch --show-current`.text()).trim();
  if (branch !== "main") {
    p.log.warn(`O clone está na branch ${branch}. O servidor deve rodar a main: git switch main`);
  }
  p.log.step("git pull --ff-only");
  await $`git pull --ff-only`;
  await up();
}

async function chooseCommand(): Promise<[Command, string | undefined]> {
  const command = orExit(
    await p.select<Command>({
      message: "O que fazer com o servidor?",
      showInstructions: false,
      options: [
        { value: "up", label: "Subir", hint: "banco, migrations, API e túnel" },
        { value: "down", label: "Derrubar", hint: "tira a API do ar; o banco continua salvo" },
        { value: "status", label: "Status", hint: "containers e endereço público" },
        { value: "logs", label: "Logs", hint: "acompanha a saída de um serviço" },
        { value: "update", label: "Atualizar", hint: "git pull e sobe a versão nova" },
      ],
    }),
  );
  if (command !== "logs") return [command, undefined];

  const service = orExit(
    await p.select<string>({
      message: "Logs de qual serviço?",
      showInstructions: false,
      options: [{ value: "", label: "todos" }, ...SERVICES.map((name) => ({ value: name, label: name }))],
    }),
  );
  return [command, service || undefined];
}

const [arg, ...rest] = process.argv.slice(2);

try {
  p.intro("Zovic · servidor");
  if (arg && !COMMANDS.includes(arg as Command)) {
    p.log.error(`Comando inválido: "${arg}". Use um de: ${COMMANDS.join(", ")}.`);
    process.exit(1);
  }
  const [command, service] = arg ? [arg as Command, rest[0]] : await chooseCommand();

  if (command === "up") await up();
  else if (command === "down") await down();
  else if (command === "status") await status();
  else if (command === "logs") await logs(service);
  else await update();
} catch (err) {
  // Erros do Bun Shell já imprimiram a saída do comando; basta o resumo.
  const exitCode = (err as { exitCode?: number }).exitCode ?? 1;
  p.log.error(`Falhou (código ${exitCode}). Veja a saída acima.`);
  process.exit(exitCode);
}
