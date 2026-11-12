import type { Server } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { MAX_AUDIO_BYTES } from "../../domain/shared/audio.ts";
import { MAX_COVER_BYTES } from "../../domain/shared/cover-image.ts";
import { createAuth } from "../auth/create-auth.ts";
import { LocalFileStorage } from "../storage/local-file-storage.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";
import { pool } from "../../infra/db/pool.ts";

// Painel de admin pela app Express real (composeApp), com o Better Auth e o banco de verdade.

const ORIGIN = "http://localhost:3000";
const PASSWORD = "uma-senha-longa";
const EMAIL_DOMAIN = "@admin-flow.zovic.test";
const PREFIX = "Admin flow";

let server: Server;
let url: string;
let adminCookie: string;
let userCookie: string;
let adminId: number;
let audioDir: string;
let coverDir: string;
const created = { musics: [] as number[], album: [] as number[], artist: [] as number[], genre: [] as number[] };

/** Arquivo de `size` bytes que começa com `header` (o domínio só olha o começo). */
function audioFile(header: number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  return bytes;
}
const MP3 = audioFile([0x49, 0x44, 0x33, 0x04, 0x00]);
const PNG = audioFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Cadastro de música em multipart: `data` com o JSON e o arquivo na parte `audio.field`. */
function postMusic(cookie: string, data: unknown, audio?: { field: string; bytes: Uint8Array }) {
  const form = new FormData();
  if (data !== undefined) form.append("data", typeof data === "string" ? data : JSON.stringify(data));
  if (audio) form.append(audio.field, new File([audio.bytes], "faixa.mp3", { type: "audio/mpeg" }));
  return fetch(`${url}/api/admin/musics`, { method: "POST", headers: { Origin: ORIGIN, Cookie: cookie }, body: form });
}

const audioPart = (bytes: Uint8Array = MP3) => ({ field: "audio", bytes });

/** Cadastro de álbum em multipart: `data` com o JSON e a imagem na parte `cover` (PNG, se nada vier). */
function postAlbum(cookie: string, data: unknown, cover: Uint8Array | null = PNG) {
  const form = new FormData();
  form.append("data", JSON.stringify(data));
  if (cover) form.append("cover", new File([cover], "capa.png", { type: "image/png" }));
  return fetch(`${url}/api/admin/albums`, { method: "POST", headers: { Origin: ORIGIN, Cookie: cookie }, body: form });
}

function putCover(cookie: string, albumId: number, cover: Uint8Array) {
  const form = new FormData();
  form.append("cover", new File([cover], "capa.png", { type: "image/png" }));
  return fetch(`${url}/api/admin/albums/${albumId}/cover`, { method: "PUT", headers: { Origin: ORIGIN, Cookie: cookie }, body: form });
}

/** Quantos arquivos o armazenamento de teste tem agora. */
async function storedFiles(): Promise<number> {
  return (await readdir(audioDir)).length;
}

function email(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
}

type Send = { method: "POST" | "PATCH" | "DELETE"; body?: unknown };

/** GET sem `send`; com `send`, o método e o corpo (em JSON). */
function call(path: string, cookie: string | null, send?: Send) {
  const headers: Record<string, string> = { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) };
  if (!send) return fetch(`${url}/api${path}`, { headers });
  if (send.body === undefined) return fetch(`${url}/api${path}`, { method: send.method, headers });
  return fetch(`${url}/api${path}`, {
    method: send.method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(send.body),
  });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

/** Cadastra pela API e devolve o cookie de sessão e o id. */
async function signUp(label: string): Promise<{ cookie: string; id: number; email: string }> {
  const address = email(label);
  const res = await fetch(`${url}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `${PREFIX} ${label}`, email: address, password: PASSWORD, birthdate: "1995-03-12" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => cookie.includes("session_token="))!;
  const { user } = await json<{ user: { id: string } }>(res);
  return { cookie: raw.split(";")[0]!, id: Number(user.id), email: address };
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "admin-flow-test-secret-with-32-chars-minimum",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  audioDir = await mkdtemp(join(tmpdir(), "zovic-admin-flow-"));
  coverDir = await mkdtemp(join(tmpdir(), "zovic-admin-covers-"));
  const storages = { audio: new LocalFileStorage(audioDir), covers: new LocalFileStorage(coverDir) };
  server = composeApp(auth, null, [ORIGIN], pool, storages).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  url = `http://127.0.0.1:${address.port}`;

  const admin = await signUp("admin");
  await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [admin.id]);
  adminCookie = admin.cookie;
  adminId = admin.id;
  userCookie = (await signUp("assinante")).cookie;
  await subscribeAccount(url, userCookie);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(audioDir, { recursive: true, force: true });
  await rm(coverDir, { recursive: true, force: true });
  for (const [table, ids] of Object.entries(created)) {
    await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::integer[])`, [ids]);
  }
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  // O pool é o da app (infra/db/pool.ts), compartilhado pelos testes HTTP: não fechar aqui,
  // senão o próximo arquivo a rodar fica sem conexão. O bun test encerra o processo no fim.
});

describe("acesso ao painel", () => {
  it("sem sessão responde 401 e assinante responde 403", async () => {
    expect((await call("/admin/stats", null)).status).toBe(401);

    const res = await call("/admin/stats", userCookie);
    expect(res.status).toBe(403);
    expect(await json<{ error: string; message: string }>(res)).toEqual({ error: "FORBIDDEN", message: expect.any(String) });
  });

  it("perde o acesso na hora em que o papel é retirado", async () => {
    const other = await signUp("rebaixado");
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [other.id]);
    expect((await call("/admin/stats", other.cookie)).status).toBe(200);

    await pool.query(`UPDATE "user" SET role = 'assinante' WHERE id = $1`, [other.id]);
    expect((await call("/admin/stats", other.cookie)).status).toBe(403);
  });
});

describe("contas", () => {
  it("o admin cria uma conta que já consegue entrar com a senha definida", async () => {
    const address = email("criada");
    const res = await call("/admin/users", adminCookie, {
      method: "POST",
      body: { name: `${PREFIX} criada`, email: address.toUpperCase(), password: PASSWORD, birthdate: "2001-02-03" },
    });
    expect(res.status).toBe(201);
    expect(await json(res)).toMatchObject({ email: address, role: "assinante", birthdate: "2001-02-03", deletedAt: null });

    const login = await fetch(`${url}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ email: address, password: PASSWORD }),
    });
    expect(login.status).toBe(200);
  });

  it("recusa email repetido, dados inválidos e assinante tentando criar", async () => {
    const existing = await signUp("repetido");
    const body = { name: "X", email: existing.email, password: PASSWORD, birthdate: "2000-01-01" };

    expect((await call("/admin/users", adminCookie, { method: "POST", body })).status).toBe(409);
    expect((await call("/admin/users", adminCookie, { method: "POST", body: { ...body, email: email("curta"), password: "123" } })).status).toBe(400);
    expect((await call("/admin/users", userCookie, { method: "POST", body: { ...body, email: email("barrado") } })).status).toBe(403);
  });

  it("remove com soft delete, derruba a sessão e não deixa remover a si mesmo", async () => {
    const target = await signUp("removido");

    expect((await call(`/admin/users/${target.id}`, adminCookie, { method: "DELETE" })).status).toBe(204);
    expect((await call("/musics", target.cookie)).status).toBe(401);
    expect((await call(`/admin/users/${target.id}`, adminCookie, { method: "DELETE" })).status).toBe(404);
    expect((await call(`/admin/users/${adminId}`, adminCookie, { method: "DELETE" })).status).toBe(409);

    const users = await json<{ id: number; deletedAt: string | null }[]>(await call(`/admin/users?q=removido`, adminCookie));
    expect(users.find((user) => user.id === target.id)?.deletedAt).toEqual(expect.any(String));
  });
});

describe("catálogo e reproduções", () => {
  let artistId: number;
  let genreId: number;
  let musicId: number;

  beforeAll(async () => {
    const genre = await pool.query<{ id: number }>(
      `INSERT INTO genre (name, color) VALUES ($1, '#d33a2c') RETURNING id`,
      [`${PREFIX} ${crypto.randomUUID().slice(0, 8)}`],
    );
    genreId = genre.rows[0]!.id;
    created.genre.push(genreId);
  });

  it("o admin cria artista e música, e edita nome, artista e gênero", async () => {
    const artist = await json<{ id: number }>(await call("/admin/artists", adminCookie, { method: "POST", body: { name: `${PREFIX} artista` } }));
    artistId = artist.id;
    created.artist.push(artistId);

    const res = await postMusic(adminCookie, { name: `${PREFIX} música`, duration: 200, artistIds: [artistId] }, audioPart());
    expect(res.status).toBe(201);
    musicId = (await json<{ id: number }>(res)).id;
    created.musics.push(musicId);

    const updated = await call(`/admin/musics/${musicId}`, adminCookie, { method: "PATCH", body: { name: `${PREFIX} música 2`, genreIds: [genreId] } });
    expect(await json(updated)).toMatchObject({ name: `${PREFIX} música 2`, artistIds: [artistId], genreIds: [genreId] });

    const renamed = await call(`/admin/artists/${artistId}`, adminCookie, { method: "PATCH", body: { name: `${PREFIX} artista 2` } });
    expect(await json(renamed)).toMatchObject({ name: `${PREFIX} artista 2` });
  });

  it("artista removido some da lista do assinante (HU-10)", async () => {
    const artist = await json<{ id: number }>(await call("/admin/artists", adminCookie, { method: "POST", body: { name: `${PREFIX} removível` } }));
    created.artist.push(artist.id);
    const before = await json<{ id: number }[]>(await call("/artists", userCookie));
    expect(before.some((listed) => listed.id === artist.id)).toBe(true);

    expect((await call(`/admin/artists/${artist.id}`, adminCookie, { method: "DELETE" })).status).toBe(204);

    const after = await json<{ id: number }[]>(await call("/artists", userCookie));
    expect(after.some((listed) => listed.id === artist.id)).toBe(false);
  });

  it("assinante não edita o catálogo", async () => {
    expect((await call(`/admin/musics/${musicId}`, userCookie, { method: "PATCH", body: { name: "Invadida" } })).status).toBe(403);
  });

  it("reprodução entra nas estatísticas por música, por gênero e nas recentes do usuário", async () => {
    const listener = await signUp("ouvinte");
    await subscribeAccount(url, listener.cookie);
    expect((await call(`/musics/${musicId}/plays`, listener.cookie, { method: "POST" })).status).toBe(204);
    expect((await call(`/musics/${musicId}/plays`, listener.cookie, { method: "POST" })).status).toBe(204);

    const stats = await json<{
      byContent: { musicId: number; plays: number }[];
      byGenre: { genreId: number; plays: number }[];
      users: { active: number };
    }>(await call("/admin/stats", adminCookie));
    expect(stats.users.active).toBeGreaterThan(0);
    expect(stats.byGenre.find((genre) => genre.genreId === genreId)?.plays).toBe(2);
    // O ranking só traz as 10 mais tocadas; se a música de teste entrou, tem 2 reproduções.
    const ranked = stats.byContent.find((music) => music.musicId === musicId);
    if (ranked) expect(ranked.plays).toBe(2);

    const recent = await json<{ musicId: number; event: string }[]>(await call(`/admin/users/${listener.id}/plays`, adminCookie));
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ musicId, event: "music_play" });
  });

  it("música removida some para o assinante, aparece marcada para o admin e não aceita reprodução", async () => {
    expect((await call(`/admin/musics/${musicId}`, adminCookie, { method: "DELETE" })).status).toBe(204);

    const forUser = await json<{ id: number }[]>(await call(`/musics?q=${encodeURIComponent(PREFIX)}`, userCookie));
    expect(forUser.some((music) => music.id === musicId)).toBe(false);

    const forAdmin = await json<{ id: number; deletedAt: string | null }[]>(
      await call(`/musics?q=${encodeURIComponent(PREFIX)}`, adminCookie),
    );
    expect(forAdmin.find((music) => music.id === musicId)?.deletedAt).toEqual(expect.any(String));

    expect((await call(`/musics/${musicId}/plays`, userCookie, { method: "POST" })).status).toBe(404);
    expect((await call(`/admin/musics/${musicId}`, adminCookie, { method: "PATCH", body: { name: "Volta" } })).status).toBe(404);
  });
});

describe("cadastro de música com áudio e álbuns", () => {
  let artistId: number;
  let genreId: number;
  let albumId: number;
  const musicData = () => ({ name: `${PREFIX} faixa`, duration: 180, artistIds: [artistId] });

  beforeAll(async () => {
    const artist = await json<{ id: number }>(await call("/admin/artists", adminCookie, { method: "POST", body: { name: `${PREFIX} banda` } }));
    artistId = artist.id;
    created.artist.push(artistId);
    const genre = await pool.query<{ id: number }>(
      `INSERT INTO genre (name, color) VALUES ($1, '#1e7f82') RETURNING id`,
      [`${PREFIX} ${crypto.randomUUID().slice(0, 8)}`],
    );
    genreId = genre.rows[0]!.id;
    created.genre.push(genreId);
  });

  it("o admin cria, edita e remove um álbum, que some da lista ao ser removido", async () => {
    const res = await postAlbum(adminCookie, { name: `${PREFIX} disco`, artistIds: [artistId], year: 2019 });
    expect(res.status).toBe(201);
    albumId = (await json<{ id: number }>(res)).id;
    created.album.push(albumId);

    const updated = await call(`/admin/albums/${albumId}`, adminCookie, { method: "PATCH", body: { year: 2020 } });
    expect(await json(updated)).toMatchObject({ year: 2020, artistIds: [artistId] });

    const listed = await json<{ id: number }[]>(await call("/albums", userCookie));
    expect(listed.find((album) => album.id === albumId)).toMatchObject({ year: 2020, artists: [{ id: artistId }] });

    const removable = await json<{ id: number }>(
      await postAlbum(adminCookie, { name: `${PREFIX} descartado`, artistIds: [artistId], year: 2001 }),
    );
    created.album.push(removable.id);
    expect((await call(`/admin/albums/${removable.id}`, adminCookie, { method: "DELETE" })).status).toBe(204);
    const afterRemoval = await json<{ id: number }[]>(await call("/albums", userCookie));
    expect(afterRemoval.some((album) => album.id === removable.id)).toBe(false);
  });

  it("recusa álbum com ano fora do intervalo", async () => {
    const res = await postAlbum(adminCookie, { name: `${PREFIX} velho`, artistIds: [artistId], year: 1899 });
    expect(res.status).toBe(400);
  });

  it("cadastra a música com áudio, álbum, gênero e explícito, e ela aparece no catálogo", async () => {
    const before = await storedFiles();
    const res = await postMusic(adminCookie, { ...musicData(), genreIds: [genreId], albumId, isExplicit: true }, audioPart());

    expect(res.status).toBe(201);
    const music = await json<{ id: number }>(res);
    created.musics.push(music.id);
    expect(music).toMatchObject({ albumId, isExplicit: true, hasAudio: true, genreIds: [genreId] });
    expect(music).not.toHaveProperty("audioFile");
    expect(await storedFiles()).toBe(before + 1);

    const listed = await json<{ id: number }[]>(await call(`/musics?q=${encodeURIComponent(`${PREFIX} faixa`)}`, userCookie));
    expect(listed.find((item) => item.id === music.id)).toMatchObject({
      album: { id: albumId, name: `${PREFIX} disco`, year: 2020 },
      isExplicit: true,
      hasAudio: true,
    });
  });

  it("tira o álbum e desmarca o explícito pela edição", async () => {
    const music = await json<{ id: number }>(await postMusic(adminCookie, { ...musicData(), albumId, isExplicit: true }, audioPart()));
    created.musics.push(music.id);

    const res = await call(`/admin/musics/${music.id}`, adminCookie, { method: "PATCH", body: { albumId: null, isExplicit: false } });

    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ albumId: null, isExplicit: false });
  });

  it("sem a parte audio, não cria a música nem grava arquivo", async () => {
    const before = await storedFiles();
    const res = await postMusic(adminCookie, musicData());

    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ message: "Music must have an audio file" });
    expect(await storedFiles()).toBe(before);
  });

  it("sem a parte data, responde 400 de validação", async () => {
    const res = await postMusic(adminCookie, undefined, audioPart());
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("com a parte data malformada, responde INVALID_JSON", async () => {
    const res = await postMusic(adminCookie, "{nope", audioPart());
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "INVALID_JSON" });
  });

  it("com o arquivo numa parte de outro nome, responde INVALID_UPLOAD", async () => {
    const res = await postMusic(adminCookie, musicData(), { field: "arquivo", bytes: MP3 });
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "INVALID_UPLOAD" });
  });

  it("com um multipart malformado, sem o separador das partes, responde INVALID_UPLOAD", async () => {
    const res = await fetch(`${url}/api/admin/musics`, {
      method: "POST",
      headers: { Origin: ORIGIN, Cookie: adminCookie, "Content-Type": "multipart/form-data" },
      body: "isto não é um multipart",
    });
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "INVALID_UPLOAD" });
  });

  it("acima de 20 MB, responde 413", async () => {
    const res = await postMusic(adminCookie, musicData(), audioPart(audioFile([0x49, 0x44, 0x33], MAX_AUDIO_BYTES + 1)));
    expect(res.status).toBe(413);
    expect(await json(res)).toMatchObject({ error: "AUDIO_TOO_LARGE" });
  });

  it("recusa um arquivo que não é MP3", async () => {
    const before = await storedFiles();
    const res = await postMusic(adminCookie, musicData(), audioPart(PNG));
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ message: "Audio file must be an MP3" });
    expect(await storedFiles()).toBe(before);
  });

  it("recusa um álbum inexistente", async () => {
    const res = await postMusic(adminCookie, { ...musicData(), albumId: 2147483647 }, audioPart());
    expect(res.status).toBe(404);
    expect(await json(res)).toMatchObject({ message: "Album not found" });
  });

  it("conta só as faixas ativas de cada álbum", async () => {
    const album = await json<{ id: number }>(
      await postAlbum(adminCookie, { name: `${PREFIX} contado`, artistIds: [artistId], year: 2010 }),
    );
    created.album.push(album.id);
    for (const name of ["um", "dois"]) {
      const music = await json<{ id: number }>(await postMusic(adminCookie, { ...musicData(), name: `${PREFIX} ${name}`, albumId: album.id }, audioPart()));
      created.musics.push(music.id);
    }
    await call(`/admin/musics/${created.musics.at(-1)}`, adminCookie, { method: "DELETE" });

    const listed = await json<{ id: number; musicCount: number }[]>(await call("/albums", userCookie));

    expect(listed.find((item) => item.id === album.id)?.musicCount).toBe(1);
  });

  it("assinante não cadastra música nem álbum", async () => {
    expect((await postMusic(userCookie, musicData(), audioPart())).status).toBe(403);
    const album = await postAlbum(userCookie, { name: "Invadido", artistIds: [artistId], year: 2000 });
    expect(album.status).toBe(403);
  });
});

/** Nome único por teste: o nome de gênero ativo é único no banco. */
const genreName = () => `${PREFIX} gênero ${crypto.randomUUID().slice(0, 8)}`;

describe("gêneros pelo painel", () => {
  it("o admin cria um gênero, que aparece na lista com a cor normalizada", async () => {
    const name = genreName();
    const res = await call("/admin/genres", adminCookie, { method: "POST", body: { name, color: "#e8a33d" } });

    expect(res.status).toBe(201);
    const genre = await json<{ id: number; color: string }>(res);
    created.genre.push(genre.id);
    expect(genre.color).toBe("#E8A33D");
    const listed = await json<{ id: number }[]>(await call("/genres", userCookie));
    expect(listed.some((item) => item.id === genre.id)).toBe(true);
  });

  it("recusa um nome que já existe", async () => {
    const name = genreName();
    const first = await json<{ id: number }>(await call("/admin/genres", adminCookie, { method: "POST", body: { name, color: "#123456" } }));
    created.genre.push(first.id);

    const res = await call("/admin/genres", adminCookie, { method: "POST", body: { name, color: "#654321" } });

    expect(res.status).toBe(409);
  });

  it("recusa cor fora do formato #RRGGBB", async () => {
    const res = await call("/admin/genres", adminCookie, { method: "POST", body: { name: genreName(), color: "laranja" } });
    expect(res.status).toBe(400);
  });

  it("assinante não cria gênero", async () => {
    const res = await call("/admin/genres", userCookie, { method: "POST", body: { name: genreName(), color: "#123456" } });
    expect(res.status).toBe(403);
  });
});

/** O coverUrl do álbum na listagem do catálogo. */
async function listedCoverUrl(id: number): Promise<string | null | undefined> {
  const listed = await json<{ id: number; coverUrl: string | null }[]>(await call("/albums", userCookie));
  return listed.find((album) => album.id === id)?.coverUrl;
}

describe("capa do álbum", () => {
  let artistId: number;
  let albumId: number;
  const albumData = (name: string) => ({ name: `${PREFIX} ${name}`, artistIds: [artistId], year: 2015 });

  beforeAll(async () => {
    const artist = await json<{ id: number }>(await call("/admin/artists", adminCookie, { method: "POST", body: { name: `${PREFIX} capista` } }));
    artistId = artist.id;
    created.artist.push(artistId);
  });

  it("cria o álbum com a capa, e o assinante recebe a imagem pela rota da capa", async () => {
    const res = await postAlbum(adminCookie, albumData("com capa"));
    expect(res.status).toBe(201);
    const album = await json<{ id: number }>(res);
    albumId = album.id;
    created.album.push(albumId);
    expect(album).toMatchObject({ hasCover: true });
    expect(album).not.toHaveProperty("coverFile");

    const coverUrl = await listedCoverUrl(albumId);
    expect(coverUrl).toMatch(new RegExp(`^/api/albums/${albumId}/cover\\?v=`));
    const image = await fetch(`${url}${coverUrl}`, { headers: { Cookie: userCookie } });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...PNG]);
  });

  it("troca a capa: a URL muda e o arquivo antigo sai do disco", async () => {
    const before = await listedCoverUrl(albumId);
    const filesBefore = await readdir(coverDir);
    const webp = audioFile([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    const res = await putCover(adminCookie, albumId, webp);

    expect(res.status).toBe(200);
    const after = await listedCoverUrl(albumId);
    expect(after).not.toBe(before);
    const filesAfter = await readdir(coverDir);
    expect(filesAfter).toHaveLength(filesBefore.length);
    expect(filesAfter.some((name) => name.endsWith(".webp"))).toBe(true);
    const image = await fetch(`${url}${after}`, { headers: { Cookie: userCookie } });
    expect(image.headers.get("content-type")).toBe("image/webp");
  });

  it("sem capa, não cria o álbum", async () => {
    const res = await postAlbum(adminCookie, albumData("sem capa"), null);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ message: "Album must have a cover image" });
  });

  it("recusa uma capa que não é imagem", async () => {
    const res = await postAlbum(adminCookie, albumData("capa errada"), MP3);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ message: "Cover image must be a JPEG, PNG or WebP" });
  });

  it("acima de 2 MB, responde 413 com o erro da capa", async () => {
    const res = await postAlbum(adminCookie, albumData("capa grande"), audioFile([0x89, 0x50, 0x4e, 0x47], MAX_COVER_BYTES + 1));
    expect(res.status).toBe(413);
    expect(await json(res)).toMatchObject({ error: "COVER_TOO_LARGE" });
  });

  it("responde 404 para um álbum sem capa e 401 sem sessão", async () => {
    const legacy = await pool.query<{ id: number }>(
      "INSERT INTO album (name, year) VALUES ($1, 2000) RETURNING id",
      [`${PREFIX} antigo`],
    );
    const legacyId = legacy.rows[0]!.id;
    created.album.push(legacyId);
    await pool.query("INSERT INTO album_artist (album_id, artist_id) VALUES ($1, $2)", [legacyId, artistId]);

    expect(await listedCoverUrl(legacyId)).toBeNull();
    expect((await fetch(`${url}/api/albums/${legacyId}/cover`, { headers: { Cookie: userCookie } })).status).toBe(404);
    expect((await fetch(`${url}/api/albums/${albumId}/cover`)).status).toBe(401);
  });

  it("assinante não troca a capa", async () => {
    expect((await putCover(userCookie, albumId, PNG)).status).toBe(403);
  });
});
