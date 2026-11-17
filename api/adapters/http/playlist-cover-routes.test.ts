import type { Server } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { MAX_COVER_BYTES } from "../../domain/shared/cover-image.ts";
import { createAuth } from "../auth/create-auth.ts";
import { LocalFileStorage } from "../storage/local-file-storage.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Capa da playlist (HU-35) pela app Express real (composeApp), com o Better Auth e o banco de verdade.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@playlist-cover.zovic.test";

interface PlaylistBody {
  id: number;
  name: string;
  coverUrl: string | null;
}

let server: Server;
let baseUrl: string;
let coverDir: string;
let ana: string;
let bruno: string;
let brunoEmail: string;
let carla: string;

/** Arquivo de `size` bytes que começa com `header` (o domínio só olha o começo). */
function fileWith(header: number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  return bytes;
}
const PNG = fileWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = fileWith([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const MP3 = fileWith([0x49, 0x44, 0x33, 0x04, 0x00]);

async function signUp(label: string): Promise<{ cookie: string; email: string }> {
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
  return { cookie, email };
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

/** Troca de capa em multipart, com a imagem na parte `field` (`cover`, se nada vier). */
function putCover(cookie: string | null, playlistId: number, cover: Uint8Array, field = "cover") {
  const form = new FormData();
  form.append(field, new File([cover], "capa.png", { type: "image/png" }));
  return fetch(`${baseUrl}/api/playlists/${playlistId}/cover`, {
    method: "PUT",
    headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: form,
  });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

async function create(cookie: string, body: Record<string, unknown>): Promise<PlaylistBody> {
  const res = await call("POST", "/playlists", cookie, body);
  expect(res.status).toBe(201);
  return json<PlaylistBody>(res);
}

async function coverOf(cookie: string, playlistId: number): Promise<string | null> {
  return (await json<PlaylistBody>(await call("GET", `/playlists/${playlistId}`, cookie))).coverUrl;
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "playlist-cover-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  coverDir = await mkdtemp(join(tmpdir(), "zovic-playlist-covers-"));
  const storages = { audio: new LocalFileStorage(coverDir), covers: new LocalFileStorage(coverDir) };
  server = composeApp(auth, null, [ORIGIN], pool, storages).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  ana = (await signUp("ana")).cookie;
  const brunoAccount = await signUp("bruno");
  bruno = brunoAccount.cookie;
  brunoEmail = brunoAccount.email;
  carla = (await signUp("carla")).cookie;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(coverDir, { recursive: true, force: true });
  await pool.query(
    `DELETE FROM playlists WHERE id IN (
       SELECT pu.playlist_id FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.end();
});

describe("capa da playlist (HU-35)", () => {
  it("a playlist nova vem sem capa", async () => {
    expect((await create(ana, { name: "Sem capa" })).coverUrl).toBeNull();
  });

  it("critério 1: o dono envia a imagem, e ela aparece na playlist, em Minhas playlists e na busca", async () => {
    const term = `Capada${crypto.randomUUID().slice(0, 6)}`;
    const playlist = await create(ana, { name: term });

    const res = await putCover(ana, playlist.id, PNG);

    expect(res.status).toBe(200);
    const { coverUrl } = await json<PlaylistBody>(res);
    expect(coverUrl).toMatch(new RegExp(`^/api/playlists/${playlist.id}/cover\\?v=`));
    expect(await coverOf(ana, playlist.id)).toBe(coverUrl);

    const mine = await json<PlaylistBody[]>(await call("GET", "/playlists", ana));
    expect(mine.find((listed) => listed.id === playlist.id)?.coverUrl).toBe(coverUrl);

    const found = await json<{ playlists: PlaylistBody[] }>(await call("GET", `/search?q=${term}`, carla));
    expect(found.playlists.find((hit) => hit.id === playlist.id)?.coverUrl).toBe(coverUrl);

    const image = await fetch(`${baseUrl}${coverUrl}`, { headers: { Cookie: carla } });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...PNG]);
  });

  it("troca a capa: a URL muda e o arquivo antigo sai do disco", async () => {
    const playlist = await create(ana, { name: "Troca" });
    await putCover(ana, playlist.id, PNG);
    const before = await coverOf(ana, playlist.id);
    const filesBefore = await readdir(coverDir);

    expect((await putCover(ana, playlist.id, WEBP)).status).toBe(200);

    const after = await coverOf(ana, playlist.id);
    expect(after).not.toBe(before);
    expect(await readdir(coverDir)).toHaveLength(filesBefore.length);
    const image = await fetch(`${baseUrl}${after}`, { headers: { Cookie: ana } });
    expect(image.headers.get("content-type")).toBe("image/webp");
  });

  it("critério 2: o dono remove a capa, e a playlist volta a ficar sem imagem", async () => {
    const playlist = await create(ana, { name: "Remove" });
    await putCover(ana, playlist.id, PNG);
    const filesBefore = await readdir(coverDir);

    const res = await call("DELETE", `/playlists/${playlist.id}/cover`, ana);

    expect(res.status).toBe(200);
    expect((await json<PlaylistBody>(res)).coverUrl).toBeNull();
    expect(await coverOf(ana, playlist.id)).toBeNull();
    expect(await readdir(coverDir)).toHaveLength(filesBefore.length - 1);
    expect((await call("GET", `/playlists/${playlist.id}/cover`, ana)).status).toBe(404);
  });

  it("critério 3: outro assinante, mesmo colaborador, recebe 403 ao trocar ou remover a capa", async () => {
    const playlist = await create(ana, { name: "Da Ana" });
    await putCover(ana, playlist.id, PNG);
    const coverUrl = await coverOf(ana, playlist.id);
    expect((await call("POST", `/playlists/${playlist.id}/collaborators`, ana, { email: brunoEmail })).status).toBe(201);

    for (const cookie of [bruno, carla]) {
      expect((await putCover(cookie, playlist.id, PNG)).status).toBe(403);
      expect((await call("DELETE", `/playlists/${playlist.id}/cover`, cookie)).status).toBe(403);
    }
    expect(await coverOf(ana, playlist.id)).toBe(coverUrl);
  });

  it("critério 4: um arquivo que não é imagem, ou acima de 2 MB, não muda a capa e diz o motivo", async () => {
    const playlist = await create(ana, { name: "Arquivo errado" });

    const wrongType = await putCover(ana, playlist.id, MP3);
    expect(wrongType.status).toBe(400);
    expect(await json(wrongType)).toMatchObject({ message: "Cover image must be a JPEG, PNG or WebP" });

    const tooLarge = await putCover(ana, playlist.id, fileWith([0x89, 0x50, 0x4e, 0x47], MAX_COVER_BYTES + 1));
    expect(tooLarge.status).toBe(413);
    expect(await json(tooLarge)).toMatchObject({ error: "COVER_TOO_LARGE" });

    const otherPart = await putCover(ana, playlist.id, PNG, "image");
    expect(otherPart.status).toBe(400);
    expect(await json(otherPart)).toMatchObject({ error: "INVALID_UPLOAD" });

    expect(await coverOf(ana, playlist.id)).toBeNull();
  });

  it("critério 5: a Músicas Curtidas não aceita capa, e nenhum arquivo fica no disco", async () => {
    const mine = await json<(PlaylistBody & { isLikedSongs: boolean })[]>(await call("GET", "/playlists", ana));
    const likedSongsId = mine.find((playlist) => playlist.isLikedSongs)!.id;
    const filesBefore = await readdir(coverDir);

    expect((await putCover(ana, likedSongsId, PNG)).status).toBe(409);
    expect((await call("DELETE", `/playlists/${likedSongsId}/cover`, ana)).status).toBe(409);
    expect(await coverOf(ana, likedSongsId)).toBeNull();
    expect(await readdir(coverDir)).toEqual(filesBefore);
  });

  it("critério 6: a capa de uma playlist privada só sai para os membros; para os outros, 404", async () => {
    const playlist = await create(ana, { name: "Privada", isPrivate: true });
    await putCover(ana, playlist.id, PNG);
    const coverUrl = await coverOf(ana, playlist.id);

    expect((await fetch(`${baseUrl}${coverUrl}`, { headers: { Cookie: ana } })).status).toBe(200);
    expect((await fetch(`${baseUrl}${coverUrl}`, { headers: { Cookie: carla } })).status).toBe(404);
  });

  it("as rotas da capa exigem sessão e um id válido", async () => {
    expect((await call("GET", "/playlists/1/cover", null)).status).toBe(401);
    expect((await putCover(null, 1, PNG)).status).toBe(401);
    expect((await call("DELETE", "/playlists/1/cover", null)).status).toBe(401);
    expect((await call("GET", "/playlists/abc/cover", ana)).status).toBe(400);
  });
});
