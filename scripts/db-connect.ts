/**
 * Abre o caminho do seu computador até o banco de produção, pelo Cloudflare Access.
 *
 *   bun db:connect       (ou a opção "banco de produção" do bun start)
 *
 * Confere se o cloudflared está instalado, faz o login no Access só quando não há um token
 * válido (o navegador abre e pede o código enviado ao seu e-mail) e deixa o banco disponível
 * em localhost:15432 até você apertar Ctrl+C. Guia completo: docs/banco-de-dados.md.
 */
import * as p from "@clack/prompts";
import { $ } from "bun";

const DB_HOSTNAME = "db.zovic.com.br";
const DB_APP_URL = `https://${DB_HOSTNAME}`;
const LOCAL_PORT = 15432;

const DOWNLOADS_URL = "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/";
const INSTALL_INSTRUCTIONS: Partial<Record<NodeJS.Platform, string>> = {
  win32: "Instale com: winget install --id Cloudflare.cloudflared",
  darwin: "Instale com: brew install cloudflared",
};

async function ensureCloudflared() {
  const version = await $`cloudflared --version`.quiet().nothrow();
  if (version.exitCode === 0) return;
  const install = INSTALL_INSTRUCTIONS[process.platform] ?? `Baixe o pacote do seu sistema em ${DOWNLOADS_URL}`;
  p.log.error(`O cloudflared não está instalado. ${install}`);
  p.log.info("Depois, abra um terminal novo e rode bun db:connect de novo.");
  process.exit(1);
}

/** O token do Access dura 24 h; o login só acontece quando ele falta ou venceu. */
async function ensureAccessToken() {
  // .quiet(): com um token válido, o comando o imprime, e ele não deve aparecer na tela.
  const token = await $`cloudflared access token --app ${DB_APP_URL}`.quiet().nothrow();
  if (token.exitCode === 0) {
    p.log.success("Login no Access ainda válido.");
    return;
  }

  p.log.step("O navegador vai abrir: informe o seu e-mail e o código que chegar nele.");
  const login = await $`cloudflared access login --quiet --auto-close ${DB_APP_URL}`.nothrow();
  if (login.exitCode !== 0) {
    p.log.error("O login no Access falhou. Confira se o seu e-mail está na lista da equipe.");
    process.exit(1);
  }
  p.log.success("Login feito.");
}

/** Faz o login no Access se preciso e mantém o caminho até o banco aberto até o Ctrl+C. */
export async function openProductionDb() {
  await ensureCloudflared();
  await ensureAccessToken();

  p.note(
    [
      `Host:     localhost`,
      `Porta:    ${LOCAL_PORT}`,
      `Banco:    zovic`,
      `Usuário e senha: os que você recebeu`,
      "",
      `psql -h localhost -p ${LOCAL_PORT} -U <seu-usuario> -d zovic`,
    ].join("\n"),
    "Conecte o DBeaver, o DataGrip ou o psql",
  );
  p.log.step("Deixe este terminal aberto enquanto usar o banco. Ctrl+C fecha o caminho.");

  // nothrow: o Ctrl+C encerra o cloudflared com código diferente de zero.
  await $`cloudflared access tcp --hostname ${DB_HOSTNAME} --url localhost:${LOCAL_PORT}`.nothrow();
}

if (import.meta.main) {
  p.intro("Zovic · banco de produção");
  await openProductionDb();
  p.outro("Caminho até o banco fechado.");
}
