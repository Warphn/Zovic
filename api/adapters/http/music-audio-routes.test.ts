import type { Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { LocalFileStorage } from "../storage/local-file-storage.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Áudio da música (HU-13) pela app Express real (composeApp), com sessão do Better Auth e o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@music-audio-routes.zovic.test";
const MUSIC_NAME_PREFIX = "Música do teste de áudio";
const AUDIO_BYTES = Uint8Array.from({ length: 64 }, (_value, index) => index);
const MINOR_BIRTHDATE = "2012-05-01";

interface Account {
  id: number;
  cookie: string;
}

let server: Server;
let baseUrl: string;
let audioDir: string;
let coverDir: string;
let subscriber: Account;
let playableMusic: number;
let explicitMusic: number;

function getAudio(musicId: number | string, cookie: string | null, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/musics/${musicId}/audio`, {
    headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}), ...headers },
  });
}

async function createAccount(label: string): Promise<Account> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
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

/** Grava os bytes de teste num arquivo novo do armazenamento e devolve o nome. */
async function storeAudio(): Promise<string> {
  const fileName = `${crypto.randomUUID()}.mp3`;
  await writeFile(join(audioDir, fileName), AUDIO_BYTES);
  return fileName;
}

async function insertMusic(name: string, audioFile: string | null, isExplicit = false): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration, audio_file, is_explicit) VALUES ($1, 180, $2, $3) RETURNING id",
    [`${MUSIC_NAME_PREFIX} ${name}`, audioFile, isExplicit],
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "music-audio-routes-test-secret-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  audioDir = await mkdtemp(join(tmpdir(), "zovic-music-audio-"));
  coverDir = await mkdtemp(join(tmpdir(), "zovic-music-audio-covers-"));
  const storages = { audio: new LocalFileStorage(audioDir), covers: new LocalFileStorage(coverDir) };
  server = composeApp(auth, null, [ORIGIN], pool, storages).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  subscriber = await createSubscriber("assinante");
  playableMusic = await insertMusic("tocável", await storeAudio());
  explicitMusic = await insertMusic("explícita", await storeAudio(), true);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.query("DELETE FROM musics WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  await pool.end();
  await rm(audioDir, { recursive: true, force: true });
  await rm(coverDir, { recursive: true, force: true });
});

describe("GET /musics/:id/audio", () => {
  it("entrega o áudio ao assinante", async () => {
    const res = await getAudio(playableMusic, subscriber.cookie);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO_BYTES);
  });

  it("entrega um trecho pedido com Range", async () => {
    const res = await getAudio(playableMusic, subscriber.cookie, { Range: "bytes=0-9" });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-9/${AUDIO_BYTES.length}`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO_BYTES.slice(0, 10));
  });

  it("recusa quem não está logado", async () => {
    expect((await getAudio(playableMusic, null)).status).toBe(401);
  });

  it("não entrega o arquivo a quem não tem assinatura", async () => {
    const withoutSubscription = await createAccount("sem-plano");

    expect((await getAudio(playableMusic, withoutSubscription.cookie)).status).toBe(403);
  });

  it("não entrega a música removida", async () => {
    const removedMusic = await insertMusic("removida", await storeAudio());
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [removedMusic]);

    expect((await getAudio(removedMusic, subscriber.cookie)).status).toBe(404);
  });

  it("não entrega a música sem arquivo", async () => {
    const musicWithoutAudio = await insertMusic("sem arquivo", null);

    expect((await getAudio(musicWithoutAudio, subscriber.cookie)).status).toBe(404);
  });

  it("responde 404 quando o arquivo sumiu do disco", async () => {
    const musicWithMissingFile = await insertMusic("arquivo sumido", `${crypto.randomUUID()}.mp3`);

    expect((await getAudio(musicWithMissingFile, subscriber.cookie)).status).toBe(404);
  });

  it("responde 404 para id malformado", async () => {
    expect((await getAudio("abc", subscriber.cookie)).status).toBe(404);
  });

  it("entrega a música explícita ao adulto", async () => {
    expect((await getAudio(explicitMusic, subscriber.cookie)).status).toBe(200);
  });

  it("confirma o arquivo guardado pelo navegador com 304, sem enviá-lo de novo", async () => {
    const first = await getAudio(playableMusic, subscriber.cookie);
    const etag = first.headers.get("etag") ?? "";
    await first.arrayBuffer();

    const revalidated = await getAudio(playableMusic, subscriber.cookie, { "If-None-Match": etag });

    expect(etag).not.toBe("");
    expect(revalidated.status).toBe(304);
  });

  it("não confirma o arquivo guardado a quem perdeu o acesso", async () => {
    const adultCopy = await getAudio(explicitMusic, subscriber.cookie);
    const etag = adultCopy.headers.get("etag") ?? "";
    await adultCopy.arrayBuffer();
    const minor = await createSubscriber("menor-cache");
    await pool.query('UPDATE "user" SET birthdate = $1 WHERE id = $2', [MINOR_BIRTHDATE, minor.id]);

    expect((await getAudio(explicitMusic, minor.cookie, { "If-None-Match": etag })).status).toBe(404);
    expect((await getAudio(explicitMusic, null, { "If-None-Match": etag })).status).toBe(401);
  });

  it("não entrega música explícita a menor de idade", async () => {
    const minor = await createSubscriber("menor");
    await pool.query('UPDATE "user" SET birthdate = $1 WHERE id = $2', [MINOR_BIRTHDATE, minor.id]);

    const res = await getAudio(explicitMusic, minor.cookie);

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ message: "Audio not found" });
  });
});
