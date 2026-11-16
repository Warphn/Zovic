import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Músicas Curtidas (HU-34) pela app Express real (composeApp), com sessão do Better Auth e o banco
// de verdade. Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@liked-musics.zovic.test";
const MUSIC_NAME_PREFIX = "Música do teste de curtidas";

interface Account {
  id: number;
  email: string;
  cookie: string;
}

interface PlaylistBody {
  id: number;
  name: string;
  isPrivate: boolean;
  isAdmin: boolean;
  isLikedSongs: boolean;
}

let server: Server;
let baseUrl: string;
let musicA: number;
let musicB: number;
let musicC: number;

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

async function createSubscriber(label: string): Promise<Account> {
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
  return { id: rows[0]!.id, email, cookie };
}

async function insertMusic(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>("INSERT INTO musics (name, duration) VALUES ($1, 180) RETURNING id", [
    `${MUSIC_NAME_PREFIX} ${name}`,
  ]);
  return rows[0]!.id;
}

async function myPlaylists(account: Account): Promise<PlaylistBody[]> {
  const res = await call("GET", "/playlists", account.cookie);
  expect(res.status).toBe(200);
  return json<PlaylistBody[]>(res);
}

async function likedSongsOf(account: Account): Promise<PlaylistBody> {
  const likedSongs = (await myPlaylists(account)).find((playlist) => playlist.isLikedSongs);
  if (!likedSongs) throw new Error("No Músicas Curtidas");
  return likedSongs;
}

async function likedMusicIds(account: Account): Promise<number[]> {
  const likedSongs = await likedSongsOf(account);
  const musics = await json<{ id: number }[]>(await call("GET", `/playlists/${likedSongs.id}/musics`, account.cookie));
  return musics.map((music) => music.id);
}

const like = (account: Account, musicId: number | string) => call("PUT", `/me/liked-musics/${musicId}`, account.cookie);
const unlike = (account: Account, musicId: number | string) => call("DELETE", `/me/liked-musics/${musicId}`, account.cookie);

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "liked-musics-routes-test-secret-32chars",
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
  musicC = await insertMusic("C");
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

describe("Músicas Curtidas", () => {
  it("exigem sessão", async () => {
    expect((await call("PUT", `/me/liked-musics/${musicA}`, null)).status).toBe(401);
    expect((await call("DELETE", `/me/liked-musics/${musicA}`, null)).status).toBe(401);
  });

  it("critério 1: conta nova vê Músicas Curtidas primeiro, privada e vazia", async () => {
    const subscriber = await createSubscriber("nova");
    await call("POST", "/playlists", subscriber.cookie, { name: "Rock" });

    const playlists = await myPlaylists(subscriber);

    expect(playlists[0]).toMatchObject({ name: "Músicas Curtidas", isPrivate: true, isAdmin: true, isLikedSongs: true });
    expect(playlists.map((playlist) => playlist.name)).toEqual(["Músicas Curtidas", "Rock"]);
    expect(await likedMusicIds(subscriber)).toEqual([]);
  });

  it("critério 2: curtir põe no topo e descurtir tira", async () => {
    const subscriber = await createSubscriber("curtir");

    for (const musicId of [musicA, musicB, musicC]) expect((await like(subscriber, musicId)).status).toBe(204);
    expect(await likedMusicIds(subscriber)).toEqual([musicC, musicB, musicA]);

    expect((await unlike(subscriber, musicB)).status).toBe(204);
    expect(await likedMusicIds(subscriber)).toEqual([musicC, musicA]);
  });

  it("curtir duas vezes não duplica nem muda a ordem", async () => {
    const subscriber = await createSubscriber("duas-vezes");
    await like(subscriber, musicA);
    await like(subscriber, musicB);

    expect((await like(subscriber, musicA)).status).toBe(204);

    expect(await likedMusicIds(subscriber)).toEqual([musicB, musicA]);
  });

  it("descurtir o que não está responde 204", async () => {
    const subscriber = await createSubscriber("descurtir");

    expect((await unlike(subscriber, musicA)).status).toBe(204);
  });

  it("curtir música removida ou inexistente dá 404, e id inválido dá 400", async () => {
    const subscriber = await createSubscriber("removida");
    const removed = await insertMusic("removida");
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [removed]);

    expect((await like(subscriber, removed)).status).toBe(404);
    expect((await like(subscriber, 2_147_483_647)).status).toBe(404);
    expect((await like(subscriber, "abc")).status).toBe(400);
  });

  it("critério 3: renomear, excluir, reordenar, pôr pelo menu e adicionar colaborador dão 409", async () => {
    const owner = await createSubscriber("regras");
    const friend = await createSubscriber("amigo");
    await like(owner, musicA);
    await like(owner, musicB);
    const likedSongs = await likedSongsOf(owner);

    expect((await call("PATCH", `/playlists/${likedSongs.id}`, owner.cookie, { name: "Outra" })).status).toBe(409);
    expect((await call("DELETE", `/playlists/${likedSongs.id}`, owner.cookie)).status).toBe(409);
    expect(
      (await call("PUT", `/playlists/${likedSongs.id}/musics/order`, owner.cookie, { musicIds: [musicA, musicB] })).status,
    ).toBe(409);
    expect((await call("POST", `/playlists/${likedSongs.id}/musics`, owner.cookie, { musicId: musicC })).status).toBe(409);
    expect(
      (await call("POST", `/playlists/${likedSongs.id}/collaborators`, owner.cookie, { email: friend.email })).status,
    ).toBe(409);
    expect((await likedSongsOf(owner)).name).toBe("Músicas Curtidas");
  });

  it("critério 4: tirar pela rota da playlist funciona", async () => {
    const subscriber = await createSubscriber("tirar");
    await like(subscriber, musicA);
    const likedSongs = await likedSongsOf(subscriber);

    expect((await call("DELETE", `/playlists/${likedSongs.id}/musics/${musicA}`, subscriber.cookie)).status).toBe(204);
    expect(await likedMusicIds(subscriber)).toEqual([]);
  });

  it("outra conta não vê a Músicas Curtidas de ninguém", async () => {
    const owner = await createSubscriber("dona");
    const stranger = await createSubscriber("estranho");
    const likedSongs = await likedSongsOf(owner);

    expect((await call("GET", `/playlists/${likedSongs.id}`, stranger.cookie)).status).toBe(404);
  });

  it("duas chamadas ao mesmo tempo criam uma Músicas Curtidas só", async () => {
    const subscriber = await createSubscriber("simultanea");

    await Promise.all([myPlaylists(subscriber), myPlaylists(subscriber), like(subscriber, musicA)]);

    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM playlists WHERE liked_by_user_id = $1", [
      subscriber.id,
    ]);
    expect(Number(rows[0]!.count)).toBe(1);
  });
});
