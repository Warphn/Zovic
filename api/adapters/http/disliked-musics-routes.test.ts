import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// O dislike (HU-20) pela app Express real (composeApp), com sessão do Better Auth e o banco de
// verdade. Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@disliked-musics.zovic.test";
const MUSIC_NAME_PREFIX = "Música do teste de dislikes";
const MINOR_BIRTHDATE = "2012-05-01";

interface Account {
  id: number;
  cookie: string;
}

let server: Server;
let baseUrl: string;
let musicA: number;
let musicB: number;

function call(method: string, path: string, cookie: string | null) {
  return fetch(`${baseUrl}/api${path}`, { method, headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) } });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

// O cadastro recusa menor de idade, então a conta nasce adulta e a data é trocada no banco.
async function createSubscriber(label: string, birthdate?: string): Promise<Account> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate: "1995-03-12" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const cookie = raw.split(";")[0]!;
  await subscribeAccount(baseUrl, cookie);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email]);
  if (birthdate) await pool.query('UPDATE "user" SET birthdate = $1 WHERE id = $2', [birthdate, rows[0]!.id]);
  return { id: rows[0]!.id, cookie };
}

async function insertMusic(name: string, options: { isExplicit?: boolean } = {}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration, is_explicit) VALUES ($1, 180, $2) RETURNING id",
    [`${MUSIC_NAME_PREFIX} ${name}`, options.isExplicit ?? false],
  );
  return rows[0]!.id;
}

const dislike = (account: Account, musicId: number | string) => call("PUT", `/me/disliked-musics/${musicId}`, account.cookie);
const removeDislike = (account: Account, musicId: number | string) =>
  call("DELETE", `/me/disliked-musics/${musicId}`, account.cookie);
const like = (account: Account, musicId: number) => call("PUT", `/me/liked-musics/${musicId}`, account.cookie);

async function dislikedMusicIds(account: Account): Promise<number[]> {
  const res = await call("GET", "/me/disliked-musics", account.cookie);
  expect(res.status).toBe(200);
  return json<number[]>(res);
}

async function likedMusicIds(account: Account): Promise<number[]> {
  const playlists = await json<{ id: number; isLikedSongs: boolean }[]>(await call("GET", "/playlists", account.cookie));
  const likedSongs = playlists.find((playlist) => playlist.isLikedSongs)!;
  const musics = await json<{ id: number }[]>(await call("GET", `/playlists/${likedSongs.id}/musics`, account.cookie));
  return musics.map((music) => music.id);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "disliked-musics-routes-test-secret-32chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Músicas próprias: o banco do CI não tem o seed de dados de exemplo
  musicA = await insertMusic("A");
  musicB = await insertMusic("B");
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
  await pool.query("DELETE FROM musics WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  await pool.end();
});

describe("dislike", () => {
  it("exige sessão", async () => {
    expect((await call("GET", "/me/disliked-musics", null)).status).toBe(401);
    expect((await call("PUT", `/me/disliked-musics/${musicA}`, null)).status).toBe(401);
    expect((await call("DELETE", `/me/disliked-musics/${musicA}`, null)).status).toBe(401);
  });

  it("dar dislike entra na lista, do mais recente para o mais antigo, e tirar sai dela", async () => {
    const subscriber = await createSubscriber("lista");

    expect((await dislike(subscriber, musicA)).status).toBe(204);
    expect((await dislike(subscriber, musicB)).status).toBe(204);
    expect(await dislikedMusicIds(subscriber)).toEqual([musicB, musicA]);

    expect((await removeDislike(subscriber, musicB)).status).toBe(204);
    expect(await dislikedMusicIds(subscriber)).toEqual([musicA]);
  });

  it("dar dislike duas vezes não duplica, e tirar o que não existe responde 204", async () => {
    const subscriber = await createSubscriber("duas-vezes");

    expect((await dislike(subscriber, musicA)).status).toBe(204);
    expect((await dislike(subscriber, musicA)).status).toBe(204);
    expect(await dislikedMusicIds(subscriber)).toEqual([musicA]);
    expect((await removeDislike(subscriber, musicB)).status).toBe(204);
  });

  it("critério 2 da HU-20: o dislike numa música com like a tira de Músicas Curtidas", async () => {
    const subscriber = await createSubscriber("tira-like");
    await like(subscriber, musicA);
    await like(subscriber, musicB);

    await dislike(subscriber, musicA);

    expect(await likedMusicIds(subscriber)).toEqual([musicB]);
  });

  it("o like numa música com dislike tira o dislike", async () => {
    const subscriber = await createSubscriber("tira-dislike");
    await dislike(subscriber, musicA);

    expect((await like(subscriber, musicA)).status).toBe(204);

    expect(await dislikedMusicIds(subscriber)).toEqual([]);
    expect(await likedMusicIds(subscriber)).toEqual([musicA]);
  });

  it("música removida ou inexistente dá 404, e id inválido dá 400", async () => {
    const subscriber = await createSubscriber("removida");
    const removed = await insertMusic("removida");
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [removed]);

    expect((await dislike(subscriber, removed)).status).toBe(404);
    expect((await dislike(subscriber, 2_147_483_647)).status).toBe(404);
    expect((await dislike(subscriber, "abc")).status).toBe(400);
  });

  it("menor de idade recebe 404 na música explícita (HU-09)", async () => {
    const minor = await createSubscriber("menor", MINOR_BIRTHDATE);
    const explicit = await insertMusic("explícita", { isExplicit: true });

    expect((await dislike(minor, explicit)).status).toBe(404);
    expect(await dislikedMusicIds(minor)).toEqual([]);
  });
});
