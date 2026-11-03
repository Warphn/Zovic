import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Artist } from "../../domain/entities/artist.ts";
import { Music } from "../../domain/entities/music.ts";
import type { PlaylistMusicItem } from "../../domain/ports/playlist-musics.ts";
import { createAuth } from "../auth/create-auth.ts";
import { PostgresArtistRepository } from "../db/postgres-artist-repository.ts";
import { PostgresMusicRepository } from "../db/postgres-music-repository.ts";
import { composeApp } from "../../infra/composition-root.ts";

// Rotas /api/playlists/:id/musics pela app Express real. As regras de SQL (ordem, soft delete,
// álbum, concorrência) estão em postgres-playlist-musics.test.ts; aqui ficam sessão, permissão,
// validação e códigos de resposta.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const artists = new PostgresArtistRepository(pool);
const musics = new PostgresMusicRepository(pool);

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@playlist-musics-routes.zovic.test";
const created = { artist: [] as number[], musics: [] as number[] };

let server: Server;
let baseUrl: string;
let ana: string;
let bruno: string;
let musicA: number;
let musicB: number;
let musicC: number;

async function signUp(label: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      name: `Teste ${label}`,
      email: `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`,
      password: "uma-senha-longa",
      birthdate: "1995-03-12",
    }),
  });
  const raw = res.headers.getSetCookie().find((value) => /session_token=/.test(value));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  return raw.split(";")[0]!;
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

async function newPlaylist(cookie: string, isPrivate = false): Promise<number> {
  const res = await call("POST", "/playlists", cookie, { name: "Músicas", isPrivate });
  expect(res.status).toBe(201);
  return (await json<{ id: number }>(res)).id;
}

const ids = async (res: Response) => (await json<PlaylistMusicItem[]>(res)).map((item) => item.id);

async function newMusic(name: string, artistId: number): Promise<number> {
  const id = await musics.nextId();
  created.musics.push(id);
  await musics.save(Music.create({ id, name, duration: 200, artistIds: [artistId] }));
  return id;
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "playlist-musics-routes-test-secret-32",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
  ana = await signUp("ana");
  bruno = await signUp("bruno");

  const artistId = await artists.nextId();
  created.artist.push(artistId);
  await artists.save(Artist.create({ id: artistId, name: "Artista das rotas" }));
  musicA = await newMusic("A", artistId);
  musicB = await newMusic("B", artistId);
  musicC = await newMusic("C", artistId);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query(
    `DELETE FROM playlists WHERE id IN (
       SELECT pu.playlist_id FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  for (const [table, list] of Object.entries(created)) {
    await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::integer[])`, [list]);
  }
  await pool.end();
});

describe("rotas das músicas da playlist", () => {
  it("exigem sessão", async () => {
    expect((await call("GET", "/playlists/1/musics", null)).status).toBe(401);
    expect((await call("POST", "/playlists/1/musics", null, { musicId: 1 })).status).toBe(401);
    expect((await call("PUT", "/playlists/1/musics/order", null, { musicIds: [] })).status).toBe(401);
    expect((await call("DELETE", "/playlists/1/musics/1", null)).status).toBe(401);
  });

  it("põe, lista, reordena e tira músicas", async () => {
    const playlistId = await newPlaylist(ana);
    const path = `/playlists/${playlistId}/musics`;

    expect(await ids(await call("GET", path, ana))).toEqual([]);

    const first = await call("POST", path, ana, { musicId: musicA });
    expect(first.status).toBe(201);
    expect(await ids(first)).toEqual([musicA]);
    expect(await ids(await call("POST", path, ana, { musicId: musicB }))).toEqual([musicA, musicB]);

    const reordered = await call("PUT", `${path}/order`, ana, { musicIds: [musicB, musicA] });
    expect(reordered.status).toBe(200);
    expect(await ids(reordered)).toEqual([musicB, musicA]);

    const removed = await call("DELETE", `${path}/${musicB}`, ana);
    expect(removed.status).toBe(204);
    expect(await ids(await call("GET", path, ana))).toEqual([musicA]);
  });

  it("devolve cada música com artistas, álbum e data de entrada", async () => {
    const playlistId = await newPlaylist(ana);
    await call("POST", `/playlists/${playlistId}/musics`, ana, { musicId: musicC });

    const [item] = await json<PlaylistMusicItem[]>(await call("GET", `/playlists/${playlistId}/musics`, ana));

    expect(item).toMatchObject({ id: musicC, name: "C", duration: 200, album: null });
    expect(item?.artists.map((a) => a.name)).toEqual(["Artista das rotas"]);
    expect(Number.isNaN(Date.parse(item?.addedAt ?? ""))).toBe(false);
  });

  it("deixa quem vê a playlist listar, mas só o admin mudar: 403 na pública, 404 na privada", async () => {
    const publica = await newPlaylist(ana);
    const privada = await newPlaylist(ana, true);
    await call("POST", `/playlists/${publica}/musics`, ana, { musicId: musicA });

    expect((await call("GET", `/playlists/${publica}/musics`, bruno)).status).toBe(200);
    expect((await call("POST", `/playlists/${publica}/musics`, bruno, { musicId: musicB })).status).toBe(403);
    expect((await call("PUT", `/playlists/${publica}/musics/order`, bruno, { musicIds: [musicA] })).status).toBe(403);
    expect((await call("DELETE", `/playlists/${publica}/musics/${musicA}`, bruno)).status).toBe(403);
    expect((await call("GET", `/playlists/${privada}/musics`, bruno)).status).toBe(404);
    expect((await call("POST", `/playlists/${privada}/musics`, bruno, { musicId: musicB })).status).toBe(404);
  });

  it("responde 404 para música inexistente ou fora da playlist e 409 para música repetida ou lista velha", async () => {
    const playlistId = await newPlaylist(ana);
    const path = `/playlists/${playlistId}/musics`;
    await call("POST", path, ana, { musicId: musicA });

    const inexistente = await call("POST", path, ana, { musicId: 2_000_000_000 });
    const repetida = await call("POST", path, ana, { musicId: musicA });
    const foraDaPlaylist = await call("DELETE", `${path}/${musicB}`, ana);
    const listaVelha = await call("PUT", `${path}/order`, ana, { musicIds: [musicA, musicB] });

    expect(inexistente.status).toBe(404);
    expect(repetida.status).toBe(409);
    expect(foraDaPlaylist.status).toBe(404);
    expect(listaVelha.status).toBe(409);
    expect((await json<{ error: string }>(listaVelha)).error).toBe("BUSINESS_RULE_ERROR");
  });

  it("recusa corpo e parâmetros inválidos com 400 apontando o campo", async () => {
    const playlistId = await newPlaylist(ana);
    const path = `/playlists/${playlistId}/musics`;
    const cases: [string, string, unknown, string][] = [
      ["POST", path, {}, "musicId"],
      ["POST", path, { musicId: "abc" }, "musicId"],
      ["POST", path, { musicId: 0 }, "musicId"],
      ["PUT", `${path}/order`, {}, "musicIds"],
      ["PUT", `${path}/order`, { musicIds: [musicA, musicA] }, "musicIds.1"],
      ["PUT", `${path}/order`, { musicIds: [1.5] }, "musicIds.0"],
      ["DELETE", `${path}/abc`, undefined, "musicId"],
      ["GET", "/playlists/abc/musics", undefined, "id"],
    ];

    for (const [method, url, body, field] of cases) {
      const res = await call(method, url, ana, body);
      const response = await json<{ fields: { field: string }[] }>(res);

      expect(res.status, `${method} ${url}`).toBe(400);
      expect(response.fields.map((f) => f.field)).toEqual([field]);
    }
  });
});
