import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { RECOMMENDATION_COUNT } from "../../domain/use-cases/recommend-musics.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// Recomendações (HU-25) pela app Express real (composeApp), com sessão do Better Auth e o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@recommendation-routes.zovic.test";
const MUSIC_NAME_PREFIX = "Música do teste de recomendação";
const GENRE_NAME_PREFIX = "Gênero do teste de recomendação";
const ADULT_BIRTHDATE = "1995-03-12";
const MINOR_BIRTHDATE = "2012-05-01";
const LISTENED_SECONDS = 31;
// Perto do teto do integer: as músicas do teste vencem as do seed na lista das mais tocadas.
const TOP_STREAMS = 2_000_000_000;

interface RecommendedBody {
  id: number;
  name: string;
  duration: number;
  artists: { id: number; name: string }[];
}

interface Account {
  id: number;
  cookie: string;
}

let server: Server;
let baseUrl: string;
let rockGenre: number;
let jazzGenre: number;

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

async function createAccount(label: string): Promise<Account> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
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

// O cadastro recusa menor de idade, então a conta nasce adulta e a data é trocada no banco.
async function createSubscriber(label: string, birthdate?: string): Promise<Account> {
  const account = await createAccount(label);
  await subscribeAccount(baseUrl, account.cookie);
  if (birthdate) await pool.query('UPDATE "user" SET birthdate = $1 WHERE id = $2', [birthdate, account.id]);
  return account;
}

async function insertGenre(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO genre (name, color) VALUES ($1, '#336699') RETURNING id",
    [`${GENRE_NAME_PREFIX} ${name}`],
  );
  return rows[0]!.id;
}

async function insertMusic(name: string, genreId: number, options: { isExplicit?: boolean; streams?: number } = {}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO musics (name, duration, is_explicit, streams) VALUES ($1, 180, $2, $3) RETURNING id",
    [`${MUSIC_NAME_PREFIX} ${name}`, options.isExplicit ?? false, options.streams ?? 0],
  );
  await pool.query("INSERT INTO genre_music (genre_id, music_id) VALUES ($1, $2)", [genreId, rows[0]!.id]);
  return rows[0]!.id;
}

async function insertMusics(prefix: string, genreId: number, count: number): Promise<number[]> {
  return Promise.all(Array.from({ length: count }, (_value, index) => insertMusic(`${prefix} ${index}`, genreId)));
}

// Os testes deixam músicas muito tocadas no banco: cada teste de "mais tocadas" começa zerando as anteriores.
async function resetTestMusicStreams(): Promise<void> {
  await pool.query("UPDATE musics SET streams = 0 WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
}

async function listen(account: Account, musicId: number): Promise<void> {
  const res = await call("POST", `/musics/${musicId}/listens`, account.cookie, { playedSeconds: LISTENED_SECONDS });
  if (res.status !== 204) throw new Error(`Listen failed with ${res.status}`);
}

async function recommendations(account: Account): Promise<RecommendedBody[]> {
  const res = await call("GET", "/recommendations", account.cookie);
  expect(res.status).toBe(200);
  return json<RecommendedBody[]>(res);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "recommendation-routes-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Gêneros próprios: o banco do CI não tem o seed de dados de exemplo.
  rockGenre = await insertGenre("rock");
  jazzGenre = await insertGenre("jazz");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.query("DELETE FROM musics WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  await pool.query("DELETE FROM genre WHERE name LIKE $1", [`${GENRE_NAME_PREFIX}%`]);
  await pool.end();
});

describe("GET /recommendations", () => {
  it("exige sessão e assinatura", async () => {
    const withoutSubscription = await createAccount("sem-plano");

    expect((await call("GET", "/recommendations", null)).status).toBe(401);
    const res = await call("GET", "/recommendations", withoutSubscription.cookie);
    expect(res.status).toBe(403);
    expect(await json<{ error: string }>(res)).toMatchObject({ error: "SUBSCRIPTION_REQUIRED" });
  });

  it("dá maioria de rock a quem só ouviu rock, sem nenhuma música já ouvida", async () => {
    const subscriber = await createSubscriber("rock");
    const [heardRock, ...otherRock] = await insertMusics("rock", rockGenre, RECOMMENDATION_COUNT + 2);
    await insertMusics("jazz", jazzGenre, 3);
    await listen(subscriber, heardRock!);

    const ids = (await recommendations(subscriber)).map((entry) => entry.id);

    expect(ids).toHaveLength(RECOMMENDATION_COUNT);
    expect(ids).not.toContain(heardRock);
    for (const id of ids) expect(otherRock).toContain(id);
  });

  it("devolve o nome, a duração e os artistas ativos de cada música", async () => {
    const subscriber = await createSubscriber("campos");
    const heardMusic = await insertMusic("campos ouvida", rockGenre);
    const music = await insertMusic("campos", rockGenre, { streams: TOP_STREAMS });
    const artistIds = await Promise.all(
      ["Zeca", "Ana", "Removido"].map(async (name) => {
        const { rows } = await pool.query<{ id: number }>("INSERT INTO artist (name) VALUES ($1) RETURNING id", [`${MUSIC_NAME_PREFIX} ${name}`]);
        await pool.query("INSERT INTO artist_music (artist_id, music_id) VALUES ($1, $2)", [rows[0]!.id, music]);
        return rows[0]!.id;
      }),
    );
    await pool.query("UPDATE artist SET deleted_at = now() WHERE id = $1", [artistIds[2]]);
    await listen(subscriber, heardMusic);

    const entry = (await recommendations(subscriber)).find((recommended) => recommended.id === music);

    expect(entry).toEqual({
      id: music,
      name: `${MUSIC_NAME_PREFIX} campos`,
      duration: 180,
      artists: [
        { id: artistIds[1]!, name: `${MUSIC_NAME_PREFIX} Ana` },
        { id: artistIds[0]!, name: `${MUSIC_NAME_PREFIX} Zeca` },
      ],
    });
    await pool.query("DELETE FROM artist WHERE name LIKE $1", [`${MUSIC_NAME_PREFIX}%`]);
  });

  it("deixa a música curtida moldar o perfil", async () => {
    const subscriber = await createSubscriber("curtida");
    // Gênero só deste teste: nenhuma outra música pontua nele
    const likedGenre = await insertGenre("curtida");
    const likedMusic = await insertMusic("curtida", likedGenre);
    const sameGenreMusic = await insertMusic("curtida do mesmo gênero", likedGenre);
    expect((await call("PUT", `/me/liked-musics/${likedMusic}`, subscriber.cookie)).status).toBe(204);

    const ids = (await recommendations(subscriber)).map((entry) => entry.id);

    expect(ids.slice(0, 2)).toEqual([likedMusic, sameGenreMusic]);
  });

  it("dá as mais tocadas a uma conta sem histórico", async () => {
    const subscriber = await createSubscriber("sem-historico");
    await resetTestMusicStreams();
    const topMusic = await insertMusic("mais tocada", rockGenre, { streams: TOP_STREAMS });
    const secondMusic = await insertMusic("segunda mais tocada", jazzGenre, { streams: TOP_STREAMS - 1 });

    const ids = (await recommendations(subscriber)).map((entry) => entry.id);

    expect(ids.slice(0, 2)).toEqual([topMusic, secondMusic]);
    expect(ids.length).toBeLessThanOrEqual(RECOMMENDATION_COUNT);
  });

  it("não entrega música com dislike da conta, com ou sem histórico", async () => {
    const subscriber = await createSubscriber("dislike");
    const other = await createSubscriber("sem-dislike");
    await resetTestMusicStreams();
    const dislikedMusic = await insertMusic("com dislike", rockGenre, { streams: TOP_STREAMS });
    const heardMusic = await insertMusic("dislike ouvida", rockGenre);
    expect((await call("PUT", `/me/disliked-musics/${dislikedMusic}`, subscriber.cookie)).status).toBe(204);

    expect((await recommendations(subscriber)).map((entry) => entry.id)).not.toContain(dislikedMusic);
    expect((await recommendations(other)).map((entry) => entry.id)[0]).toBe(dislikedMusic);

    await listen(subscriber, heardMusic);
    expect((await recommendations(subscriber)).map((entry) => entry.id)).not.toContain(dislikedMusic);
  });

  it("não entrega música removida", async () => {
    const subscriber = await createSubscriber("removida");
    const removedMusic = await insertMusic("removida", rockGenre, { streams: TOP_STREAMS });
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [removedMusic]);

    expect((await recommendations(subscriber)).map((entry) => entry.id)).not.toContain(removedMusic);
  });

  it("não entrega música explícita a menor de idade, com ou sem histórico", async () => {
    const minor = await createSubscriber("menor", MINOR_BIRTHDATE);
    const adult = await createSubscriber("maior");
    await resetTestMusicStreams();
    const heardMusic = await insertMusic("explícita ouvida", rockGenre);
    const explicitMusic = await insertMusic("explícita", rockGenre, { isExplicit: true, streams: TOP_STREAMS });
    const commonMusic = await insertMusic("comum", rockGenre, { streams: TOP_STREAMS - 1 });

    expect((await recommendations(minor)).map((entry) => entry.id)).not.toContain(explicitMusic);
    expect((await recommendations(adult)).map((entry) => entry.id).slice(0, 2)).toEqual([explicitMusic, commonMusic]);

    await listen(minor, heardMusic);
    await listen(adult, heardMusic);
    expect((await recommendations(minor)).map((entry) => entry.id)).not.toContain(explicitMusic);
    expect((await recommendations(adult)).map((entry) => entry.id)).toContain(explicitMusic);
  });
});
