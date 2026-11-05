import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts } from "./testing/subscriptions.ts";

// Plano familiar pela app Express real (composeApp): convites, cadastro pelo link, remoção e saída.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@plan-invitations.zovic.test";
const PASSWORD = "uma-senha-longa";
const ADULT_BIRTHDATE = "1995-03-12";
const MINOR_BIRTHDATE = `${new Date().getFullYear() - 10}-06-15`;
const FAMILY_LIMIT = 4;
const INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const UNKNOWN_TOKEN = "A".repeat(43);

interface Account {
  cookie: string;
  id: number;
  email: string;
}

interface InvitationBody {
  id: number;
  email: string;
  expiresAt: string;
  token: string;
}

interface MembersBody {
  members: { id: number; name: string; email: string | null; isManager: boolean }[];
  pendingInvitations: { id: number; email: string; expiresAt: string }[];
  limit: number;
  freeSlots: number;
}

interface SubscriptionBody {
  planId: number;
  kind: "individual" | "family";
  isManager: boolean;
  startedAt: string;
}

let server: Server;
let baseUrl: string;
let musicId: number;

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
}

function call(method: string, path: string, cookie: string | null, body?: unknown) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

/** Cadastro direto pela API do Better Auth, com campos extras opcionais (como o invitationToken). */
async function register(label: string, extra: Record<string, unknown> = {}, email = uniqueEmail(label)) {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: PASSWORD, birthdate: ADULT_BIRTHDATE, ...extra }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  return { res, email, cookie: raw ? raw.split(";")[0]! : null };
}

async function createAccount(label: string, email = uniqueEmail(label)): Promise<Account> {
  const { cookie } = await register(label, {}, email);
  if (!cookie) throw new Error("Sign-up failed");
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email.toLowerCase()]);
  return { cookie, id: rows[0]!.id, email: email.toLowerCase() };
}

async function accountExists(email: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM "user" WHERE email = $1', [email]);
  return rows.length > 0;
}

/** Conta nova que assina o plano familiar e passa a ser a gestora. */
async function createManager(label: string): Promise<Account> {
  const manager = await createAccount(label);
  const res = await call("POST", "/plans", manager.cookie, { kind: "family" });
  if (res.status !== 201) throw new Error(`Family subscribe failed with ${res.status}`);
  return manager;
}

async function invite(manager: Account, email: string): Promise<InvitationBody> {
  const res = await call("POST", "/plans/me/invitations", manager.cookie, { email });
  if (res.status !== 201) throw new Error(`Invite failed with ${res.status}`);
  return json<InvitationBody>(res);
}

/** Gestora com um convite aceito por uma conta nova (adulta) já membro. */
async function addMember(manager: Account, label: string): Promise<Account> {
  const email = uniqueEmail(label);
  const invitation = await invite(manager, email);
  const member = await createAccount(label, email);
  const res = await call("POST", `/invitations/${invitation.token}/accept`, member.cookie);
  if (res.status !== 200) throw new Error(`Accept failed with ${res.status}`);
  return member;
}

async function members(manager: Account): Promise<MembersBody> {
  return json<MembersBody>(await call("GET", "/plans/me/members", manager.cookie));
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "plan-invitations-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Música própria: o banco do CI não tem o seed de dados de exemplo.
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration) VALUES ($1, 180) RETURNING id",
    ["Música do teste de convites"],
  );
  musicId = rows[0]!.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query(
    `DELETE FROM playlists WHERE id IN (
       SELECT pu.playlist_id FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.query("DELETE FROM musics WHERE id = $1", [musicId]);
  await pool.end();
});

describe("cadastro pelo link do convite", () => {
  it("menor sem conta se cadastra pelo link e já é membro", async () => {
    const manager = await createManager("gestor-menor");
    const email = uniqueEmail("filho");
    const invitation = await invite(manager, email);

    const { res, cookie } = await register("filho", { birthdate: MINOR_BIRTHDATE, invitationToken: invitation.token }, email);

    expect(res.status).toBe(200);
    expect(cookie).not.toBeNull();
    // O token não volta na resposta do cadastro.
    expect(JSON.stringify(await res.json())).not.toContain(invitation.token);
    const subscription = await json<SubscriptionBody>(await call("GET", "/plans/me", cookie));
    expect(subscription).toMatchObject({ kind: "family", isManager: false });
    expect((await call("GET", "/musics", cookie)).status).toBe(200);
    expect(await members(manager)).toMatchObject({ pendingInvitations: [], freeSlots: FAMILY_LIMIT - 2 });
  });

  it("adulto que se cadastra pelo link também vira membro", async () => {
    const manager = await createManager("gestor-adulto");
    const email = uniqueEmail("convidado");
    const invitation = await invite(manager, email);

    const { res, cookie } = await register("convidado", { invitationToken: invitation.token }, email);

    expect(res.status).toBe(200);
    expect(await json<SubscriptionBody>(await call("GET", "/plans/me", cookie))).toMatchObject({
      kind: "family",
      isManager: false,
    });
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(404);
  });

  it("o campo invitationToken não vai para o banco", async () => {
    const manager = await createManager("gestor-campo");
    const email = uniqueEmail("campo");
    const invitation = await invite(manager, email);
    await register("campo", { invitationToken: invitation.token }, email);

    const { rows } = await pool.query('SELECT * FROM "user" WHERE email = $1', [email]);

    expect(Object.keys(rows[0] ?? {}).filter((column) => /invitation/i.test(column))).toEqual([]);
    expect(JSON.stringify(rows[0])).not.toContain(invitation.token);
  });

  it("menor sem convite recebe 403 MINOR_NEEDS_INVITATION e a conta não é criada", async () => {
    const email = uniqueEmail("menor-sem-convite");

    const { res, cookie } = await register("menor-sem-convite", { birthdate: MINOR_BIRTHDATE }, email);

    expect(res.status).toBe(403);
    expect(await json<{ code: string }>(res)).toMatchObject({ code: "MINOR_NEEDS_INVITATION" });
    expect(cookie).toBeNull();
    expect(await accountExists(email)).toBe(false);
  });

  it("token desconhecido, de outro email ou que não é texto é recusado e a conta não é criada", async () => {
    const manager = await createManager("gestor-recusa");
    const otherInvitation = await invite(manager, uniqueEmail("outro"));

    for (const [label, token] of [
      ["desconhecido", UNKNOWN_TOKEN],
      ["de-outro-email", otherInvitation.token],
      ["numero", 12345],
      ["vazio", ""],
      ["gigante", "A".repeat(5000)],
    ] as const) {
      // Adulto e menor: o token inválido nunca é ignorado em silêncio.
      for (const birthdate of [ADULT_BIRTHDATE, MINOR_BIRTHDATE]) {
        const email = uniqueEmail(`recusa-${label}`);
        const { res } = await register(`recusa-${label}`, { birthdate, invitationToken: token }, email);

        expect(`${label} ${res.status}`).toBe(`${label} 400`);
        expect(await json<{ code: string }>(res)).toMatchObject({ code: "INVALID_INVITATION" });
        expect(await accountExists(email)).toBe(false);
      }
    }
  });

  it("convite expirado, cancelado ou já usado não serve para se cadastrar", async () => {
    const manager = await createManager("gestor-cadastro-morto");
    const expired = await invite(manager, uniqueEmail("exp"));
    await pool.query("UPDATE plan_invitation SET expires_at = now() - interval '1 minute' WHERE id = $1", [expired.id]);
    const canceled = await invite(manager, uniqueEmail("canc"));
    await call("DELETE", `/plans/me/invitations/${canceled.id}`, manager.cookie);

    for (const invitation of [expired, canceled]) {
      const { res } = await register("morto", { invitationToken: invitation.token }, invitation.email);

      expect(res.status).toBe(400);
      expect(await accountExists(invitation.email)).toBe(false);
    }
  });

  it("conta criada pelo admin continua podendo ser de menor", async () => {
    const admin = await createAccount("admin");
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [admin.id]);
    const email = uniqueEmail("menor-do-admin");

    const res = await call("POST", "/admin/users", admin.cookie, {
      name: "Menor do admin",
      email,
      password: PASSWORD,
      birthdate: MINOR_BIRTHDATE,
    });

    expect(res.status).toBe(201);
    expect(await accountExists(email)).toBe(true);
  });
});

describe("HU-04: assinar o plano familiar", () => {
  it("assina o Família, vira gestor e vê 1 de 4 vagas", async () => {
    const manager = await createAccount("assina-familia");

    const res = await call("POST", "/plans", manager.cookie, { kind: "family" });

    expect(res.status).toBe(201);
    expect(await json<SubscriptionBody>(res)).toMatchObject({ kind: "family", isManager: true });
    expect(await members(manager)).toMatchObject({
      limit: FAMILY_LIMIT,
      freeSlots: FAMILY_LIMIT - 1,
      members: [{ id: manager.id, isManager: true }],
      pendingInvitations: [],
    });
  });

  it("sem corpo continua individual e um tipo desconhecido responde 400", async () => {
    const account = await createAccount("tipo-plano");

    expect((await call("POST", "/plans", account.cookie, { kind: "empresarial" })).status).toBe(400);
    const res = await call("POST", "/plans", account.cookie);

    expect(res.status).toBe(201);
    expect(await json<SubscriptionBody>(res)).toMatchObject({ kind: "individual" });
  });

  it("menor recebe 403 ao assinar o Família", async () => {
    const manager = await createManager("gestor-do-menor");
    const email = uniqueEmail("menor-familia");
    const invitation = await invite(manager, email);
    const { cookie } = await register("menor-familia", { birthdate: MINOR_BIRTHDATE, invitationToken: invitation.token }, email);
    const minor = await call("GET", "/plans/me", cookie);
    expect(minor.status).toBe(200);

    const res = await call("POST", "/plans", cookie, { kind: "family" });

    expect(res.status).toBe(403);
    expect(await json<{ error: string }>(res)).toMatchObject({ error: "FORBIDDEN" });
  });
});

describe("HU-05: convidar membros", () => {
  it("as rotas protegidas exigem sessão e a consulta do convite é pública", async () => {
    for (const [method, path] of [
      ["GET", "/plans/me/members"],
      ["POST", "/plans/me/invitations"],
      ["DELETE", "/plans/me/invitations/1"],
      ["DELETE", "/plans/me/members/1"],
      ["DELETE", "/plans/me/membership"],
      ["POST", `/invitations/${UNKNOWN_TOKEN}/accept`],
    ] as const) {
      expect(`${method} ${path} ${(await call(method, path, null)).status}`).toBe(`${method} ${path} 401`);
    }
    // Sem sessão e com token desconhecido, a consulta chega ao caso de uso (404), não ao 401.
    expect((await call("GET", `/invitations/${UNKNOWN_TOKEN}`, null)).status).toBe(404);
  });

  it("gera um link de uso único válido por 7 dias e deixa o convite pendente", async () => {
    const manager = await createManager("gestor-link");
    const email = uniqueEmail("alvo");

    const res = await call("POST", "/plans/me/invitations", manager.cookie, { email });

    expect(res.status).toBe(201);
    const invitation = await json<InvitationBody>(res);
    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitation.email).toBe(email);
    expect(Math.abs(Date.parse(invitation.expiresAt) - (Date.now() + INVITATION_VALIDITY_MS))).toBeLessThan(ONE_MINUTE_MS);
    expect(await members(manager)).toMatchObject({
      pendingInvitations: [{ id: invitation.id, email }],
      freeSlots: FAMILY_LIMIT - 2,
    });
  });

  it("o token nunca volta depois de criado e o banco guarda só o hash", async () => {
    const manager = await createManager("gestor-token");
    const invitation = await invite(manager, uniqueEmail("sigilo"));

    const list = JSON.stringify(await members(manager));
    const consulted = JSON.stringify(await (await call("GET", `/invitations/${invitation.token}`, null)).json());

    expect(list).not.toContain(invitation.token);
    expect(consulted).not.toContain(invitation.token);
    const { rows } = await pool.query<{ token_hash: string }>("SELECT token_hash FROM plan_invitation WHERE id = $1", [
      invitation.id,
    ]);
    expect(rows[0]!.token_hash).not.toBe(invitation.token);
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a consulta pública devolve email, nome do gestor e validade", async () => {
    const manager = await createManager("gestor-consulta");
    const email = uniqueEmail("consulta");
    const invitation = await invite(manager, email);

    const res = await call("GET", `/invitations/${invitation.token}`, null);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      email,
      managerName: "Teste gestor-consulta",
      expiresAt: invitation.expiresAt,
    });
  });

  it("com 4 pessoas entre membros e convites, o próximo convite é recusado", async () => {
    const manager = await createManager("gestor-lotado");
    await addMember(manager, "lotado-a");
    await invite(manager, uniqueEmail("lotado-b"));
    await invite(manager, uniqueEmail("lotado-c"));

    const res = await call("POST", "/plans/me/invitations", manager.cookie, { email: uniqueEmail("lotado-d") });

    expect(res.status).toBe(409);
    expect(await members(manager)).toMatchObject({ freeSlots: 0 });
  });

  it("5 convites simultâneos de um gestor sozinho: 3 passam e 2 são recusados", async () => {
    const manager = await createManager("gestor-corrida");

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        call("POST", "/plans/me/invitations", manager.cookie, { email: uniqueEmail(`corrida-${index}`) }),
      ),
    );

    const statuses = responses.map((res) => res.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(FAMILY_LIMIT - 1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(5 - (FAMILY_LIMIT - 1));
    expect(await members(manager)).toMatchObject({ freeSlots: 0 });
  });

  it("cancelar o convite mata o link e devolve a vaga", async () => {
    const manager = await createManager("gestor-cancela");
    const invitation = await invite(manager, uniqueEmail("cancelado"));
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 2 });

    const res = await call("DELETE", `/plans/me/invitations/${invitation.id}`, manager.cookie);

    expect(res.status).toBe(204);
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(404);
    expect(await members(manager)).toMatchObject({ pendingInvitations: [], freeSlots: FAMILY_LIMIT - 1 });
    expect((await call("DELETE", `/plans/me/invitations/${invitation.id}`, manager.cookie)).status).toBe(404);
  });

  it("cancelar o plano faz os convites pendentes deixarem de valer", async () => {
    const manager = await createManager("gestor-cancela-plano");
    const invitation = await invite(manager, uniqueEmail("pendente"));
    const guest = await createAccount("pendente", invitation.email);

    expect((await call("DELETE", "/plans/me", manager.cookie)).status).toBe(204);

    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(404);
    expect((await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie)).status).toBe(404);
  });

  it("recusa quem não é gestor, plano individual, email repetido, email de membro e email inválido", async () => {
    const manager = await createManager("gestor-regras");
    const member = await addMember(manager, "membro-regras");
    const pendingEmail = uniqueEmail("ja-convidado");
    await invite(manager, pendingEmail);

    expect((await call("POST", "/plans/me/invitations", member.cookie, { email: uniqueEmail("x") })).status).toBe(403);
    expect((await call("POST", "/plans/me/invitations", manager.cookie, { email: pendingEmail.toUpperCase() })).status).toBe(409);
    expect((await call("POST", "/plans/me/invitations", manager.cookie, { email: member.email })).status).toBe(409);
    for (const body of [{ email: "nao-e-email" }, {}, { email: `${"a".repeat(260)}@x.test` }]) {
      expect((await call("POST", "/plans/me/invitations", manager.cookie, body)).status).toBe(400);
    }

    const individual = await createAccount("individual");
    await call("POST", "/plans", individual.cookie);
    expect((await call("POST", "/plans/me/invitations", individual.cookie, { email: uniqueEmail("y") })).status).toBe(409);
    const noPlan = await createAccount("sem-plano");
    expect((await call("POST", "/plans/me/invitations", noPlan.cookie, { email: uniqueEmail("z") })).status).toBe(404);
  });

  it("só o gestor lista membros e cancela convites", async () => {
    const manager = await createManager("gestor-permissoes");
    const member = await addMember(manager, "membro-permissoes");
    const invitation = await invite(manager, uniqueEmail("permissao"));

    expect((await call("GET", "/plans/me/members", member.cookie)).status).toBe(403);
    expect((await call("DELETE", `/plans/me/invitations/${invitation.id}`, member.cookie)).status).toBe(403);
    expect((await call("DELETE", "/plans/me/invitations/abc", manager.cookie)).status).toBe(400);
    expect((await call("DELETE", "/plans/me/invitations/999999999", manager.cookie)).status).toBe(404);
  });

  it("um gestor não cancela o convite de outro plano", async () => {
    const manager = await createManager("gestor-dono");
    const stranger = await createManager("gestor-intruso");
    const invitation = await invite(manager, uniqueEmail("alheio"));

    expect((await call("DELETE", `/plans/me/invitations/${invitation.id}`, stranger.cookie)).status).toBe(404);
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(200);
  });
});

describe("HU-06: aceitar o convite", () => {
  it("a conta com o email certo aceita e o link deixa de valer", async () => {
    const manager = await createManager("gestor-aceite");
    const guest = await createAccount("aceite");
    const invitation = await invite(manager, guest.email);

    const res = await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie);

    expect(res.status).toBe(200);
    expect(await json<SubscriptionBody>(res)).toMatchObject({ kind: "family", isManager: false });
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(404);
    expect((await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie)).status).toBe(404);
    expect((await members(manager)).members.map((member) => member.id)).toContain(guest.id);
  });

  it("conta com outro email é recusada e o convite continua valendo", async () => {
    const manager = await createManager("gestor-outro-email");
    const invitation = await invite(manager, uniqueEmail("destino"));
    const intruder = await createAccount("intruso");

    const res = await call("POST", `/invitations/${invitation.token}/accept`, intruder.cookie);

    expect(res.status).toBe(403);
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(200);
    expect(await (await call("GET", "/plans/me", intruder.cookie)).json()).toBeNull();
  });

  it("o email do convite com maiúsculas vale para a conta, que o guarda em minúsculas", async () => {
    const manager = await createManager("gestor-caixa");
    const mixedCaseEmail = `Caixa-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`.toUpperCase();
    const guest = await createAccount("caixa", mixedCaseEmail.toLowerCase());
    const invitation = await invite(manager, mixedCaseEmail);

    expect(invitation.email).toBe(mixedCaseEmail.toLowerCase());
    const res = await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie);

    expect(res.status).toBe(200);
  });

  it("quem já tem assinatura ativa é recusado, com 409, e o convite continua valendo", async () => {
    const manager = await createManager("gestor-ocupado");
    const guest = await createAccount("ocupado");
    await call("POST", "/plans", guest.cookie);
    const invitation = await invite(manager, guest.email);

    const res = await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie);

    expect(res.status).toBe(409);
    expect(await json<{ message: string }>(res)).toMatchObject({
      message: "Leave or cancel your current plan before accepting an invitation",
    });
    expect((await call("GET", `/invitations/${invitation.token}`, null)).status).toBe(200);
  });

  it("dois aceites simultâneos do mesmo convite: um só vira membro", async () => {
    const manager = await createManager("gestor-aceite-duplo");
    const guest = await createAccount("aceite-duplo");
    const invitation = await invite(manager, guest.email);

    const responses = await Promise.all([
      call("POST", `/invitations/${invitation.token}/accept`, guest.cookie),
      call("POST", `/invitations/${invitation.token}/accept`, guest.cookie),
    ]);

    expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
    expect(responses.filter((res) => res.status !== 200).every((res) => [404, 409].includes(res.status))).toBe(true);
    const { rows } = await pool.query("SELECT 1 FROM plan_user WHERE user_id = $1", [guest.id]);
    expect(rows).toHaveLength(1);
  });

  it("convite expirado, usado, cancelado ou de plano cancelado é inválido na consulta e no aceite", async () => {
    const manager = await createManager("gestor-invalidos");
    const expired = await invite(manager, uniqueEmail("expirado"));
    await pool.query("UPDATE plan_invitation SET expires_at = now() - interval '1 minute' WHERE id = $1", [expired.id]);
    const used = await invite(manager, uniqueEmail("usado"));
    await pool.query("UPDATE plan_invitation SET accepted_at = now() WHERE id = $1", [used.id]);
    const canceled = await invite(manager, uniqueEmail("cancelado"));
    await call("DELETE", `/plans/me/invitations/${canceled.id}`, manager.cookie);
    const ofCanceledPlan = await invite(manager, uniqueEmail("plano-cancelado"));
    await pool.query("UPDATE plan SET deleted_at = now() WHERE id = (SELECT plan_id FROM plan_invitation WHERE id = $1)", [
      ofCanceledPlan.id,
    ]);

    for (const invitation of [expired, used, canceled, ofCanceledPlan]) {
      const guest = await createAccount("invalido", invitation.email);

      const consulted = await call("GET", `/invitations/${invitation.token}`, null);
      const accepted = await call("POST", `/invitations/${invitation.token}/accept`, guest.cookie);

      expect(`${invitation.email} ${consulted.status}`).toBe(`${invitation.email} 404`);
      expect(`${invitation.email} ${accepted.status}`).toBe(`${invitation.email} 404`);
      expect(await json<{ message: string }>(consulted)).toMatchObject({ message: "Invitation not found" });
    }
  });

  it("token malformado responde 404, como um convite inexistente", async () => {
    for (const token of ["a%20b", "%21%21", "A".repeat(500), "token.com.ponto"]) {
      const res = await call("GET", `/invitations/${token}`, null);

      expect(`${token.slice(0, 10)} ${res.status}`).toBe(`${token.slice(0, 10)} 404`);
      expect(await json<{ error: string }>(res)).toMatchObject({ error: "NOT_FOUND" });
    }
  });
});

describe("HU-07: remover e sair", () => {
  it("o gestor remove: o acesso cai na próxima requisição e a vaga volta", async () => {
    const manager = await createManager("gestor-remove");
    const member = await addMember(manager, "removido");
    expect((await call("GET", "/musics", member.cookie)).status).toBe(200);
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 2 });

    const res = await call("DELETE", `/plans/me/members/${member.id}`, manager.cookie);

    expect(res.status).toBe(204);
    expect((await call("GET", "/musics", member.cookie)).status).toBe(403);
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 1 });
  });

  it("o membro sai: perde o acesso e o gestor vê a vaga", async () => {
    const manager = await createManager("gestor-sai");
    const member = await addMember(manager, "saiu");

    const res = await call("DELETE", "/plans/me/membership", member.cookie);

    expect(res.status).toBe(204);
    expect((await call("GET", "/musics", member.cookie)).status).toBe(403);
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 1 });
  });

  it("membro que tenta remover outro recebe 403 e ninguém sai", async () => {
    const manager = await createManager("gestor-forbidden");
    const member = await addMember(manager, "membro-a");
    const other = await addMember(manager, "membro-b");

    const res = await call("DELETE", `/plans/me/members/${other.id}`, member.cookie);

    expect(res.status).toBe(403);
    expect((await call("GET", "/musics", other.cookie)).status).toBe(200);
  });

  it("o gestor não sai nem se remove: ele cancela o plano", async () => {
    const manager = await createManager("gestor-fica");

    expect((await call("DELETE", "/plans/me/membership", manager.cookie)).status).toBe(409);
    expect((await call("DELETE", `/plans/me/members/${manager.id}`, manager.cookie)).status).toBe(409);
    expect((await call("GET", "/plans/me", manager.cookie)).status).toBe(200);
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 1 });
  });

  it("remover quem não é do plano responde 404 e um id inválido 400", async () => {
    const manager = await createManager("gestor-estranho");
    const stranger = await createAccount("estranho");

    expect((await call("DELETE", `/plans/me/members/${stranger.id}`, manager.cookie)).status).toBe(404);
    expect((await call("DELETE", "/plans/me/members/abc", manager.cookie)).status).toBe(400);
    expect((await call("DELETE", "/plans/me/membership", stranger.cookie)).status).toBe(404);
  });

  it("quem saiu mantém o histórico e as playlists", async () => {
    const manager = await createManager("gestor-historico");
    const member = await addMember(manager, "historico");
    const created = await call("POST", "/playlists", member.cookie, { name: "Minha lista" });
    expect(created.status).toBe(201);
    const { id: playlistId } = await json<{ id: number }>(created);
    expect((await call("POST", `/musics/${musicId}/plays`, member.cookie)).status).toBe(204);

    await call("DELETE", "/plans/me/membership", member.cookie);
    expect((await call("GET", "/playlists", member.cookie)).status).toBe(403);
    await call("POST", "/plans", member.cookie);

    const playlists = await json<{ id: number }[]>(await call("GET", "/playlists", member.cookie));
    expect(playlists.map((playlist) => playlist.id)).toContain(playlistId);
    const { rows } = await pool.query("SELECT 1 FROM user_event WHERE user_id = $1 AND music_id = $2", [member.id, musicId]);
    expect(rows).toHaveLength(1);
  });

  it("conta removida pela plataforma não ocupa vaga nem aparece entre os membros", async () => {
    const manager = await createManager("gestor-conta-removida");
    const member = await addMember(manager, "conta-removida");
    expect(await members(manager)).toMatchObject({ freeSlots: FAMILY_LIMIT - 2 });

    await pool.query('UPDATE "user" SET deleted_at = now() WHERE id = $1', [member.id]);

    const roster = await members(manager);
    expect(roster.members.map((listed) => listed.id)).toEqual([manager.id]);
    expect(roster.freeSlots).toBe(FAMILY_LIMIT - 1);
  });
});
