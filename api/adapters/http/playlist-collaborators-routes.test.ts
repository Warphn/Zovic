import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Colaboradores de playlist (HU-19) pela app Express real (composeApp), com sessão do Better Auth e
// o banco de verdade. Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@playlist-collaborators.zovic.test";
const MUSIC_NAME = "Música do teste de colaboradores";

interface Account {
  id: number;
  email: string;
  cookie: string;
}

interface PlaylistBody {
  id: number;
  isAdmin: boolean;
  canEditMusics: boolean;
}

interface CollaboratorBody {
  userId: number;
  name: string;
  isOwner: boolean;
}

let server: Server;
let baseUrl: string;
let musicId: number;

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

async function createAccount(label: string, { isSubscriber = true } = {}): Promise<Account> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate: "1995-03-12" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const cookie = raw.split(";")[0]!;
  if (isSubscriber) await subscribeAccount(baseUrl, cookie);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email]);
  return { id: rows[0]!.id, email, cookie };
}

async function createPlaylist(owner: Account, isPrivate = false): Promise<number> {
  const res = await call("POST", "/playlists", owner.cookie, { name: "Colaborativa", isPrivate });
  expect(res.status).toBe(201);
  return (await json<PlaylistBody>(res)).id;
}

async function addCollaborator(owner: Account, playlistId: number, email: string) {
  return call("POST", `/playlists/${playlistId}/collaborators`, owner.cookie, { email });
}

async function myPlaylistIds(account: Account): Promise<number[]> {
  return (await json<PlaylistBody[]>(await call("GET", "/playlists", account.cookie))).map((playlist) => playlist.id);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "playlist-collaborators-test-secret-32ch",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Música própria: o banco do CI não tem o seed de dados de exemplo
  const { rows } = await pool.query<{ id: number }>("INSERT INTO musics (name, duration) VALUES ($1, 180) RETURNING id", [MUSIC_NAME]);
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
  await pool.query("DELETE FROM musics WHERE name = $1", [MUSIC_NAME]);
  await pool.end();
});

describe("colaboradores de playlist", () => {
  it("exigem sessão", async () => {
    expect((await call("GET", "/playlists/1/collaborators", null)).status).toBe(401);
    expect((await call("POST", "/playlists/1/collaborators", null, { email: "x@zovic.test" })).status).toBe(401);
    expect((await call("DELETE", "/playlists/1/collaborators/1", null)).status).toBe(401);
  });

  it("critério 1: o colaborador adicionado vê a playlist em Minhas playlists", async () => {
    const owner = await createAccount("dona");
    const collaborator = await createAccount("colaborador");
    const playlistId = await createPlaylist(owner, true);

    const res = await addCollaborator(owner, playlistId, collaborator.email);

    expect(res.status).toBe(201);
    expect(await json<CollaboratorBody[]>(res)).toEqual([
      { userId: owner.id, name: "Teste dona", isOwner: true },
      { userId: collaborator.id, name: "Teste colaborador", isOwner: false },
    ]);
    expect(await myPlaylistIds(collaborator)).toContain(playlistId);
  });

  it("critério 2: a música que o colaborador põe aparece para o dono", async () => {
    const owner = await createAccount("dona-musica");
    const collaborator = await createAccount("colaborador-musica");
    const playlistId = await createPlaylist(owner);
    await addCollaborator(owner, playlistId, collaborator.email);

    expect((await call("POST", `/playlists/${playlistId}/musics`, collaborator.cookie, { musicId })).status).toBe(201);

    const musics = await json<{ id: number }[]>(await call("GET", `/playlists/${playlistId}/musics`, owner.cookie));
    expect(musics.map((music) => music.id)).toEqual([musicId]);
  });

  it("critério 3: o colaborador não renomeia nem exclui", async () => {
    const owner = await createAccount("dona-gestao");
    const collaborator = await createAccount("colaborador-gestao");
    const playlistId = await createPlaylist(owner);
    await addCollaborator(owner, playlistId, collaborator.email);

    expect((await call("PATCH", `/playlists/${playlistId}`, collaborator.cookie, { name: "Invasão" })).status).toBe(403);
    expect((await call("DELETE", `/playlists/${playlistId}`, collaborator.cookie)).status).toBe(403);
    expect((await addCollaborator(collaborator, playlistId, owner.email)).status).toBe(403);
  });

  it("critério 4: o colaborador removido perde a edição e a privada some", async () => {
    const owner = await createAccount("dona-remocao");
    const collaborator = await createAccount("colaborador-removido");
    const playlistId = await createPlaylist(owner, true);
    await addCollaborator(owner, playlistId, collaborator.email);

    expect((await call("DELETE", `/playlists/${playlistId}/collaborators/${collaborator.id}`, owner.cookie)).status).toBe(204);

    expect((await call("POST", `/playlists/${playlistId}/musics`, collaborator.cookie, { musicId })).status).toBe(404);
    expect((await call("GET", `/playlists/${playlistId}`, collaborator.cookie)).status).toBe(404);
    expect(await myPlaylistIds(collaborator)).not.toContain(playlistId);
  });

  it("o colaborador removido de uma pública continua vendo, mas não edita", async () => {
    const owner = await createAccount("dona-publica");
    const collaborator = await createAccount("colaborador-publica");
    const playlistId = await createPlaylist(owner);
    await addCollaborator(owner, playlistId, collaborator.email);
    await call("DELETE", `/playlists/${playlistId}/collaborators/${collaborator.id}`, owner.cookie);

    expect((await call("POST", `/playlists/${playlistId}/musics`, collaborator.cookie, { musicId })).status).toBe(403);
  });

  it("o colaborador sai e a playlist some da lista dele; o dono não sai", async () => {
    const owner = await createAccount("dona-saida");
    const collaborator = await createAccount("colaborador-saida");
    const playlistId = await createPlaylist(owner, true);
    await addCollaborator(owner, playlistId, collaborator.email);

    expect((await call("DELETE", `/playlists/${playlistId}/collaborators/${collaborator.id}`, collaborator.cookie)).status).toBe(204);
    expect(await myPlaylistIds(collaborator)).not.toContain(playlistId);
    expect((await call("DELETE", `/playlists/${playlistId}/collaborators/${owner.id}`, owner.cookie)).status).toBe(409);
  });

  it("acha a conta pelo email com maiúsculas e espaços", async () => {
    const owner = await createAccount("dona-email");
    const collaborator = await createAccount("colaborador-email");
    const playlistId = await createPlaylist(owner);

    expect((await addCollaborator(owner, playlistId, `  ${collaborator.email.toUpperCase()}  `)).status).toBe(201);
  });

  it("recusa email sem conta ou de conta removida com 404, sem plano com 409 e repetido com 409", async () => {
    const owner = await createAccount("dona-erros");
    const withoutPlan = await createAccount("sem-plano", { isSubscriber: false });
    const removed = await createAccount("removida");
    const collaborator = await createAccount("colaborador-repetido");
    await pool.query('UPDATE "user" SET deleted_at = now() WHERE id = $1', [removed.id]);
    const playlistId = await createPlaylist(owner);
    await addCollaborator(owner, playlistId, collaborator.email);

    expect((await addCollaborator(owner, playlistId, `ninguem${EMAIL_DOMAIN}`)).status).toBe(404);
    expect((await addCollaborator(owner, playlistId, removed.email)).status).toBe(404);
    expect((await addCollaborator(owner, playlistId, withoutPlan.email)).status).toBe(409);
    expect((await addCollaborator(owner, playlistId, collaborator.email)).status).toBe(409);
  });

  it("recusa email inválido e ids inválidos com 400", async () => {
    const owner = await createAccount("dona-invalido");
    const playlistId = await createPlaylist(owner);

    expect((await addCollaborator(owner, playlistId, "não é email")).status).toBe(400);
    expect((await call("POST", `/playlists/${playlistId}/collaborators`, owner.cookie, {})).status).toBe(400);
    expect((await call("DELETE", `/playlists/${playlistId}/collaborators/abc`, owner.cookie)).status).toBe(400);
    expect((await call("GET", "/playlists/abc/collaborators", owner.cookie)).status).toBe(400);
  });

  it("a resposta da playlist traz canEditMusics para o colaborador e não para quem só vê", async () => {
    const owner = await createAccount("dona-flag");
    const collaborator = await createAccount("colaborador-flag");
    const viewer = await createAccount("visitante-flag");
    const playlistId = await createPlaylist(owner);
    await addCollaborator(owner, playlistId, collaborator.email);

    const asCollaborator = await json<PlaylistBody>(await call("GET", `/playlists/${playlistId}`, collaborator.cookie));
    const asViewer = await json<PlaylistBody>(await call("GET", `/playlists/${playlistId}`, viewer.cookie));

    expect(asCollaborator).toMatchObject({ isAdmin: false, canEditMusics: true });
    expect(asViewer).toMatchObject({ isAdmin: false, canEditMusics: false });
  });
});
