import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";

// Rotas de assinatura pela app Express real (composeApp), com sessão do Better Auth e o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@subscription-routes.zovic.test";

interface SubscriptionBody {
  planId: number;
  kind: "individual" | "family";
  isManager: boolean;
  startedAt: string;
}

interface Account {
  cookie: string;
  id: number;
}

let server: Server;
let baseUrl: string;

async function signUp(label: string, birthdate = "1995-03-12"): Promise<Account> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email]);
  return { cookie: raw.split(";")[0]!, id: rows[0]!.id };
}

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password: "uma-senha-longa" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-in failed with ${res.status}`);
  return raw.split(";")[0]!;
}

function call(method: string, path: string, cookie: string | null) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
  });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

/** Plano familiar ativo montado direto no banco (convites ainda não existem). */
async function createFamilyPlan(manager: Account, members: Account[]): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO plan (name, type_id) SELECT 'Família teste', id FROM plan_type WHERE name = 'Família' RETURNING id`,
  );
  const planId = rows[0]!.id;
  await pool.query("INSERT INTO plan_user (plan_id, user_id, is_admin) VALUES ($1, $2, true)", [planId, manager.id]);
  for (const member of members) {
    await pool.query("INSERT INTO plan_user (plan_id, user_id, is_admin) VALUES ($1, $2, false)", [planId, member.id]);
  }
  return planId;
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "subscription-routes-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query(
    `DELETE FROM plan WHERE id IN (
       SELECT pu.plan_id FROM plan_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  await pool.end();
});

describe("assinatura individual", () => {
  it("exige sessão nas três rotas", async () => {
    for (const [method, path] of [
      ["POST", "/plans"],
      ["GET", "/plans/me"],
      ["DELETE", "/plans/me"],
    ] as const) {
      expect((await call(method, path, null)).status).toBe(401);
    }
  });

  it("sem assinatura, GET /plans/me responde 200 com null", async () => {
    const ana = await signUp("sem-plano");
    const res = await call("GET", "/plans/me", ana.cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("assina, consulta, cancela e assina de novo", async () => {
    const ana = await signUp("ciclo");

    const created = await call("POST", "/plans", ana.cookie);
    expect(created.status).toBe(201);
    const subscription = await json<SubscriptionBody>(created);
    expect(subscription).toMatchObject({ kind: "individual", isManager: true });
    expect(Number.isNaN(Date.parse(subscription.startedAt))).toBe(false);

    const mine = await call("GET", "/plans/me", ana.cookie);
    expect(mine.status).toBe(200);
    expect(await json<SubscriptionBody>(mine)).toEqual(subscription);

    const canceled = await call("DELETE", "/plans/me", ana.cookie);
    expect(canceled.status).toBe(204);
    expect(await (await call("GET", "/plans/me", ana.cookie)).json()).toBeNull();

    const again = await call("POST", "/plans", ana.cookie);
    expect(again.status).toBe(201);
    expect((await json<SubscriptionBody>(again)).planId).not.toBe(subscription.planId);
  });

  it("a assinatura continua ativa em outra sessão da mesma conta", async () => {
    const ana = await signUp("outra-sessao");
    const { rows } = await pool.query<{ email: string }>('SELECT email FROM "user" WHERE id = $1', [ana.id]);
    const subscription = await json<SubscriptionBody>(await call("POST", "/plans", ana.cookie));

    const otherSession = await signIn(rows[0]!.email);
    expect(otherSession).not.toBe(ana.cookie);
    const mine = await call("GET", "/plans/me", otherSession);

    expect(await json<SubscriptionBody>(mine)).toEqual(subscription);
  });

  it("recusa menor de idade com 403 e não cria assinatura", async () => {
    const year = new Date().getFullYear() - 10;
    const menor = await signUp("menor", `${year}-06-15`);

    const res = await call("POST", "/plans", menor.cookie);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "FORBIDDEN" });
    expect(await (await call("GET", "/plans/me", menor.cookie)).json()).toBeNull();
    const { rows } = await pool.query("SELECT 1 FROM plan_user WHERE user_id = $1", [menor.id]);
    expect(rows).toHaveLength(0);
  });

  it("recusa a segunda assinatura com 409", async () => {
    const ana = await signUp("duplicada");
    expect((await call("POST", "/plans", ana.cookie)).status).toBe(201);

    const res = await call("POST", "/plans", ana.cookie);

    expect(res.status).toBe(409);
    const { rows } = await pool.query("SELECT 1 FROM plan_user WHERE user_id = $1", [ana.id]);
    expect(rows).toHaveLength(1);
  });

  it("assinaturas simultâneas da mesma conta criam só uma", async () => {
    const ana = await signUp("corrida");

    const statuses = (await Promise.all(Array.from({ length: 5 }, () => call("POST", "/plans", ana.cookie)))).map(
      (res) => res.status,
    );

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(4);
    const { rows } = await pool.query("SELECT 1 FROM plan_user WHERE user_id = $1", [ana.id]);
    expect(rows).toHaveLength(1);
  });

  it("cancelar sem assinatura responde 404", async () => {
    const ana = await signUp("cancela-nada");

    expect((await call("DELETE", "/plans/me", ana.cookie)).status).toBe(404);
  });
});

describe("plano familiar", () => {
  it("o membro de um familiar não assina outra e não cancela", async () => {
    const gestora = await signUp("gestora");
    const membro = await signUp("membro");
    const planId = await createFamilyPlan(gestora, [membro]);

    expect(await json<SubscriptionBody>(await call("GET", "/plans/me", membro.cookie))).toMatchObject({
      planId,
      kind: "family",
      isManager: false,
    });
    expect((await call("POST", "/plans", membro.cookie)).status).toBe(409);
    expect((await call("DELETE", "/plans/me", membro.cookie)).status).toBe(403);
    expect(await json<SubscriptionBody>(await call("GET", "/plans/me", membro.cookie))).toMatchObject({ planId });
  });

  it("o gestor cancela e todos perdem o acesso, mas as contas continuam", async () => {
    const gestor = await signUp("gestor");
    const membro = await signUp("membro-2");
    const planId = await createFamilyPlan(gestor, [membro]);

    expect((await call("DELETE", "/plans/me", gestor.cookie)).status).toBe(204);

    expect(await (await call("GET", "/plans/me", gestor.cookie)).json()).toBeNull();
    expect(await (await call("GET", "/plans/me", membro.cookie)).json()).toBeNull();
    const { rows: users } = await pool.query(
      'SELECT 1 FROM "user" WHERE id = ANY($1) AND deleted_at IS NULL',
      [[gestor.id, membro.id]],
    );
    expect(users).toHaveLength(2);
    // O vínculo fica no banco: só o plano deixa de estar ativo.
    const { rows: links } = await pool.query("SELECT 1 FROM plan_user WHERE plan_id = $1", [planId]);
    expect(links).toHaveLength(2);

    // Ex-membro volta a poder assinar.
    expect((await call("POST", "/plans", membro.cookie)).status).toBe(201);
  });
});
