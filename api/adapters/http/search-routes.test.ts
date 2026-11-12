import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Artist } from "../../domain/entities/artist.ts";
import type { SearchResults } from "../../domain/ports/search-query.ts";
import { createAuth } from "../auth/create-auth.ts";
import { PostgresArtistRepository } from "../db/postgres-artist-repository.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { deletePlansOfAccounts, subscribeAccount } from "./testing/subscriptions.ts";

// GET /api/search pela app Express real. As regras de busca (acentos, ordem, visibilidade)
// estão em postgres-search-query.test.ts; aqui ficam sessão, validação e formato da resposta.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const artists = new PostgresArtistRepository(pool);

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@search-routes.zovic.test";
const T = `qz${Date.now().toString(36).replace(/\d/g, (d) => "abcdefghij"[Number(d)]!)}`;
const artistIds: number[] = [];

let server: Server;
let baseUrl: string;
let cookie: string;

async function signUp(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      name: "Teste busca",
      email: `busca-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`,
      password: "uma-senha-longa",
      birthdate: "1995-03-12",
    }),
  });
  const raw = res.headers.getSetCookie().find((value) => /session_token=/.test(value));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const sessionCookie = raw.split(";")[0]!;
  await subscribeAccount(baseUrl, sessionCookie);
  return sessionCookie;
}

function get(query: string, withSession = true) {
  return fetch(`${baseUrl}/api/search${query}`, { headers: withSession ? { Cookie: cookie } : {} });
}

async function json<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T;
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "search-routes-test-secret-with-32-chars",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
  cookie = await signUp();

  for (const name of [`Água${T} um`, `Água${T} dois`]) {
    const id = await artists.nextId();
    artistIds.push(id);
    await artists.save(Artist.create({ id, name }));
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query("DELETE FROM artist WHERE id = ANY($1::integer[])", [artistIds]);
  await deletePlansOfAccounts(pool, `%${EMAIL_DOMAIN}`);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.end();
});

describe("GET /api/search", () => {
  it("exige sessão", async () => {
    const res = await get(`?q=agua${T}`, false);

    expect(res.status).toBe(401);
  });

  it("devolve músicas, artistas, álbuns e playlists que casam com o termo", async () => {
    const res = await get(`?q=${encodeURIComponent(` agua${T} `)}`);
    const body = await json<SearchResults>(res);

    expect(res.status).toBe(200);
    expect(body).toEqual({
      musics: [],
      artists: [
        { id: artistIds[1]!, name: `Água${T} dois`, musicCount: 0 },
        { id: artistIds[0]!, name: `Água${T} um`, musicCount: 0 },
      ],
      albums: [],
      playlists: [],
    });
  });

  it("converte limit da query string e limita cada grupo", async () => {
    const body = await json<SearchResults>(await get(`?q=agua${T}&limit=1`));

    expect(body.artists).toHaveLength(1);
  });

  it("recusa q ausente, vazio ou longo demais e limit inválido com 400", async () => {
    const cases: [string, string][] = [
      ["", "q"],
      ["?q=", "q"],
      ["?q=%20%20", "q"],
      [`?q=${"a".repeat(101)}`, "q"],
      ["?q=rock&limit=0", "limit"],
      ["?q=rock&limit=51", "limit"],
      ["?q=rock&limit=abc", "limit"],
      ["?q=rock&limit=1.5", "limit"],
    ];

    for (const [query, field] of cases) {
      const res = await get(query);
      const body = await json<{ error: string; fields: { field: string }[] }>(res);

      expect(res.status, query).toBe(400);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.fields.map((f) => f.field)).toEqual([field]);
    }
  });
});
