import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Histórico (HU-24) pela app Express real (composeApp), com sessão do Better Auth e o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@history-routes.zovic.test";
const MUSIC_NAME_PREFIX = "Música do teste de histórico";

interface HistoryEntryBody {
  musicId: number;
  name: string;
  duration: number;
  artists: { id: number; name: string }[];
  lastPlayedAt: string;
  isAvailable: boolean;
}

interface Account {
  id: number;
  cookie: string;
}

let server: Server;
let baseUrl: string;
let musicA: number;
let musicB: number;

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

async function createAccount(label: string, email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`): Promise<Account> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate: "1995-03-12" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email.toLowerCase()]);
  return { id: rows[0]!.id, cookie: raw.split(";")[0]! };
}

async function createSubscriber(label: string): Promise<Account> {
  const account = await createAccount(label);
  await subscribeAccount(baseUrl, account.cookie);
  return account;
}

async function insertMusic(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration) VALUES ($1, 180) RETURNING id",
    [`${MUSIC_NAME_PREFIX} ${name}`],
  );
  return rows[0]!.id;
}

async function play(account: Account, musicId: number): Promise<void> {
  const res = await call("POST", `/musics/${musicId}/plays`, account.cookie);
  if (res.status !== 204) throw new Error(`Play failed with ${res.status}`);
}

async function history(account: Account): Promise<HistoryEntryBody[]> {
  const res = await call("GET", "/history", account.cookie);
  expect(res.status).toBe(200);
  return json<HistoryEntryBody[]>(res);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "history-routes-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Músicas próprias: o banco do CI não tem o seed de dados de exemplo.
  musicA = await insertMusic("A");
  musicB = await insertMusic("B");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.query("DELETE FROM musics WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  await pool.end();
});

describe("GET /history", () => {
  it("exige sessão e assinatura", async () => {
    const withoutSubscription = await createAccount("sem-plano");

    expect((await call("GET", "/history", null)).status).toBe(401);
    const res = await call("GET", "/history", withoutSubscription.cookie);
    expect(res.status).toBe(403);
    expect(await json<{ error: string }>(res)).toMatchObject({ error: "SUBSCRIPTION_REQUIRED" });
  });

  it("mostra cada música uma vez, com a última reprodução, a mais recente primeiro", async () => {
    const subscriber = await createSubscriber("ordem");
    await play(subscriber, musicA);
    await play(subscriber, musicB);
    await play(subscriber, musicA);

    const entries = await history(subscriber);

    expect(entries.map((entry) => entry.musicId)).toEqual([musicA, musicB]);
    expect(entries[0]).toMatchObject({ name: `${MUSIC_NAME_PREFIX} A`, duration: 180, artists: [], isAvailable: true });
    expect(new Date(entries[0]!.lastPlayedAt).getTime()).toBeGreaterThan(new Date(entries[1]!.lastPlayedAt).getTime());
  });

  it("separa o histórico de cada membro do mesmo plano", async () => {
    const manager = await createAccount("gestora");
    expect((await call("POST", "/plans", manager.cookie, { kind: "family" })).status).toBe(201);
    const memberEmail = `membro-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
    const invitation = await json<{ token: string }>(
      await call("POST", "/plans/me/invitations", manager.cookie, { email: memberEmail }),
    );
    const member = await createAccount("membro", memberEmail);
    expect((await call("POST", `/invitations/${invitation.token}/accept`, member.cookie)).status).toBe(200);

    await play(manager, musicA);
    await play(member, musicB);

    expect((await history(manager)).map((entry) => entry.musicId)).toEqual([musicA]);
    expect((await history(member)).map((entry) => entry.musicId)).toEqual([musicB]);
  });

  it("mantém a música removida pelo admin, marcada como indisponível", async () => {
    const subscriber = await createSubscriber("removida");
    const removedMusic = await insertMusic("removida");
    await play(subscriber, removedMusic);
    await play(subscriber, musicA);

    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [removedMusic]);
    const entries = await history(subscriber);

    expect(entries.map((entry) => [entry.musicId, entry.isAvailable])).toEqual([
      [musicA, true],
      [removedMusic, false],
    ]);
  });

  it("devolve lista vazia para uma conta nova", async () => {
    const subscriber = await createSubscriber("nova");

    expect(await history(subscriber)).toEqual([]);
  });
});
