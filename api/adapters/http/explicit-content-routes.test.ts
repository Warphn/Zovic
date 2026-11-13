import type { Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { ADULT_AGE, calendarDateIn, TIME_ZONE } from "../../domain/shared/age.ts";
import { createAuth } from "../auth/create-auth.ts";
import { LocalFileStorage } from "../storage/local-file-storage.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts } from "./testing/subscriptions.ts";

// Conteúdo explícito para menores (HU-09) pela app Express real (composeApp): um menor e um maior
// no mesmo plano familiar, cada um com a sua sessão do Better Auth, contra o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@explicit-content-routes.zovic.test";
const MUSIC_NAME_PREFIX = "Conteúdo explícito do teste";
const ADULT_BIRTHDATE = "1995-03-12";
const MINOR_BIRTHDATE = "2012-05-01";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AUDIO_BYTES = Uint8Array.from({ length: 16 }, (_value, index) => index);

interface Account {
  id: number;
  cookie: string;
}

interface MusicBody {
  id: number;
  name: string;
}

let server: Server;
let baseUrl: string;
let audioDir: string;
let coverDir: string;
let adult: Account;
let minor: Account;
let commonMusic: number;
let explicitMusic: number;
let sharedPlaylist: number;

function call(method: string, path: string, cookie: string, body?: unknown) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

async function createAccount(label: string, email: string): Promise<Account> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate: ADULT_BIRTHDATE }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email.toLowerCase()]);
  return { id: rows[0]!.id, cookie: raw.split(";")[0]! };
}

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
}

/** Conta nova que assina o plano familiar, convida uma segunda conta e a vê entrar no plano. */
async function createFamilyPlan(): Promise<{ manager: Account; member: Account }> {
  const manager = await createAccount("gestor", uniqueEmail("gestor"));
  const subscribed = await call("POST", "/plans", manager.cookie, { kind: "family" });
  if (subscribed.status !== 201) throw new Error(`Family subscribe failed with ${subscribed.status}`);

  const memberEmail = uniqueEmail("membro");
  const invited = await call("POST", "/plans/me/invitations", manager.cookie, { email: memberEmail });
  if (invited.status !== 201) throw new Error(`Invite failed with ${invited.status}`);
  const { token } = await json<{ token: string }>(invited);
  const member = await createAccount("membro", memberEmail);
  const accepted = await call("POST", `/invitations/${token}/accept`, member.cookie);
  if (accepted.status !== 200) throw new Error(`Accept failed with ${accepted.status}`);
  return { manager, member };
}

async function setBirthdate(account: Account, birthdate: string): Promise<void> {
  await pool.query('UPDATE "user" SET birthdate = $1 WHERE id = $2', [birthdate, account.id]);
}

async function insertMusic(name: string, audioFile: string, isExplicit: boolean): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration, audio_file, is_explicit) VALUES ($1, 180, $2, $3) RETURNING id",
    [`${MUSIC_NAME_PREFIX} ${name}`, audioFile, isExplicit],
  );
  return rows[0]!.id;
}

async function storeAudio(): Promise<string> {
  const fileName = `${crypto.randomUUID()}.mp3`;
  await writeFile(join(audioDir, fileName), AUDIO_BYTES);
  return fileName;
}

async function searchMusicIds(account: Account): Promise<number[]> {
  const res = await call("GET", `/search?q=${encodeURIComponent(MUSIC_NAME_PREFIX)}`, account.cookie);
  return (await json<{ musics: MusicBody[] }>(res)).musics.map((music) => music.id);
}

/** A data de nascimento de quem completa 18 anos no dia (de São Paulo) do instante. */
function eighteenthBirthdayOn(instant: Date): string {
  const day = calendarDateIn(instant, TIME_ZONE);
  // Quem nasceu em 29/02 só completa a idade em 1º/03 nos anos comuns; o teste usa o dia 28.
  const monthAndDay = day.slice(4) === "-02-29" ? "-02-28" : day.slice(4);
  return `${Number(day.slice(0, 4)) - ADULT_AGE}${monthAndDay}`;
}

async function playlistMusicIds(account: Account, playlistId: number): Promise<number[]> {
  const res = await call("GET", `/playlists/${playlistId}/musics`, account.cookie);
  expect(res.status).toBe(200);
  return (await json<MusicBody[]>(res)).map((music) => music.id);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "explicit-content-routes-secret-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  audioDir = await mkdtemp(join(tmpdir(), "zovic-explicit-audio-"));
  coverDir = await mkdtemp(join(tmpdir(), "zovic-explicit-covers-"));
  const storages = { audio: new LocalFileStorage(audioDir), covers: new LocalFileStorage(coverDir) };
  server = composeApp(auth, null, [ORIGIN], pool, storages).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // O gestor (maior de idade) e o membro, que passa a ser o menor do plano.
  const { manager, member } = await createFamilyPlan();
  adult = manager;
  minor = member;
  await setBirthdate(minor, MINOR_BIRTHDATE);

  commonMusic = await insertMusic("comum", await storeAudio(), false);
  explicitMusic = await insertMusic("explícita", await storeAudio(), true);

  // Playlist pública do maior de idade, com as duas músicas, que o menor abre como de outra pessoa.
  const created = await call("POST", "/playlists", adult.cookie, { name: "Mista do teste", isPrivate: false });
  sharedPlaylist = (await json<{ id: number }>(created)).id;
  for (const musicId of [commonMusic, explicitMusic]) {
    const added = await call("POST", `/playlists/${sharedPlaylist}/musics`, adult.cookie, { musicId });
    if (added.status !== 201) throw new Error(`Add music failed with ${added.status}`);
  }

  // O menor ouviu a explícita antes de a regra valer; a inserção direta contorna o 404 do play.
  await pool.query("INSERT INTO user_event (user_id, event_type, music_id) VALUES ($1, 'music_play', $2), ($1, 'music_play', $3)", [
    minor.id,
    commonMusic,
    explicitMusic,
  ]);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query("DELETE FROM playlists WHERE id = $1", [sharedPlaylist]);
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.query("DELETE FROM musics WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  await pool.end();
  await rm(audioDir, { recursive: true, force: true });
  await rm(coverDir, { recursive: true, force: true });
});

describe("músicas explícitas para menores (HU-09)", () => {
  it("o menor não vê a explícita no catálogo, e o maior do mesmo plano vê", async () => {
    const forMinor = await json<MusicBody[]>(await call("GET", `/musics?q=${encodeURIComponent(MUSIC_NAME_PREFIX)}`, minor.cookie));
    const forAdult = await json<MusicBody[]>(await call("GET", `/musics?q=${encodeURIComponent(MUSIC_NAME_PREFIX)}`, adult.cookie));

    expect(forMinor.map((music) => music.id)).toEqual([commonMusic]);
    expect(forAdult.map((music) => music.id)).toEqual([commonMusic, explicitMusic]);
  });

  it("o menor não acha a explícita na busca, e o maior acha", async () => {
    expect(await searchMusicIds(minor)).toEqual([commonMusic]);
    expect(await searchMusicIds(adult)).toEqual([commonMusic, explicitMusic]);
  });

  it("o menor não vê a explícita na playlist de outra pessoa, e o maior vê", async () => {
    expect(await playlistMusicIds(minor, sharedPlaylist)).toEqual([commonMusic]);
    expect(await playlistMusicIds(adult, sharedPlaylist)).toEqual([commonMusic, explicitMusic]);
  });

  it("o menor não vê a explícita no histórico, e o maior que a ouviu vê", async () => {
    const entryIds = async (account: Account) => {
      const res = await call("GET", "/history", account.cookie);
      return (await json<{ musicId: number }[]>(res)).map((entry) => entry.musicId);
    };
    expect(await call("POST", `/musics/${explicitMusic}/plays`, adult.cookie).then((res) => res.status)).toBe(204);

    expect(await entryIds(minor)).toEqual([commonMusic]);
    expect(await entryIds(adult)).toEqual([explicitMusic]);
  });

  it("o menor recebe 404 ao pedir o áudio e o play da explícita, e o maior toca", async () => {
    const audioOfMinor = await call("GET", `/musics/${explicitMusic}/audio`, minor.cookie);
    const playOfMinor = await call("POST", `/musics/${explicitMusic}/plays`, minor.cookie);
    const audioOfAdult = await call("GET", `/musics/${explicitMusic}/audio`, adult.cookie);
    const playOfAdult = await call("POST", `/musics/${explicitMusic}/plays`, adult.cookie);

    expect(audioOfMinor.status).toBe(404);
    expect(playOfMinor.status).toBe(404);
    expect(audioOfAdult.status).toBe(200);
    expect(playOfAdult.status).toBe(204);
  });

  it("o play da explícita pelo menor não conta nos streams", async () => {
    const { rows: before } = await pool.query<{ streams: number }>("SELECT streams FROM musics WHERE id = $1", [explicitMusic]);

    await call("POST", `/musics/${explicitMusic}/plays`, minor.cookie);

    const { rows: after } = await pool.query<{ streams: number }>("SELECT streams FROM musics WHERE id = $1", [explicitMusic]);
    expect(after[0]!.streams).toBe(before[0]!.streams);
  });

  it("o menor não consegue pôr a explícita numa playlist", async () => {
    const created = await call("POST", "/playlists", minor.cookie, { name: "Do menor", isPrivate: true });
    const ownPlaylist = (await json<{ id: number }>(created)).id;

    const added = await call("POST", `/playlists/${ownPlaylist}/musics`, minor.cookie, { musicId: explicitMusic });
    const addedCommon = await call("POST", `/playlists/${ownPlaylist}/musics`, minor.cookie, { musicId: commonMusic });

    expect(added.status).toBe(404);
    expect(addedCommon.status).toBe(201);
    await pool.query("DELETE FROM playlists WHERE id = $1", [ownPlaylist]);
  });

  it("o admin da plataforma vê a explícita no catálogo mesmo sendo menor de idade", async () => {
    const platformAdmin = await createAccount("admin", uniqueEmail("admin"));
    await pool.query(`UPDATE "user" SET role = 'admin', birthdate = $1 WHERE id = $2`, [MINOR_BIRTHDATE, platformAdmin.id]);
    await call("POST", "/plans", platformAdmin.cookie);

    const res = await call("GET", `/musics?q=${encodeURIComponent(MUSIC_NAME_PREFIX)}`, platformAdmin.cookie);

    expect((await json<MusicBody[]>(res)).map((music) => music.id)).toEqual([commonMusic, explicitMusic]);
  });

  it("quem faz 18 anos hoje já vê a explícita, e quem faz amanhã ainda não", async () => {
    const catalogIds = async () => {
      const res = await call("GET", `/musics?q=${encodeURIComponent(MUSIC_NAME_PREFIX)}`, minor.cookie);
      return (await json<MusicBody[]>(res)).map((music) => music.id);
    };
    const now = new Date();
    const tomorrow = new Date(now.getTime() + ONE_DAY_MS);

    await setBirthdate(minor, eighteenthBirthdayOn(tomorrow));
    expect(await catalogIds()).toEqual([commonMusic]);

    await setBirthdate(minor, eighteenthBirthdayOn(now));
    expect(await catalogIds()).toEqual([commonMusic, explicitMusic]);
  });
});
