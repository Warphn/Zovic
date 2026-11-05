import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createAuth } from "../auth/create-auth.ts";
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
const created = { musics: [] as number[], artist: [] as number[], genre: [] as number[] };

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
  server = composeApp(auth, null, [ORIGIN]).listen(0);
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

    const res = await call("/admin/musics", adminCookie, { method: "POST", body: { name: `${PREFIX} música`, duration: 200, artistIds: [artistId] } });
    expect(res.status).toBe(201);
    musicId = (await json<{ id: number }>(res)).id;
    created.musics.push(musicId);

    const updated = await call(`/admin/musics/${musicId}`, adminCookie, { method: "PATCH", body: { name: `${PREFIX} música 2`, genreIds: [genreId] } });
    expect(await json(updated)).toMatchObject({ name: `${PREFIX} música 2`, artistIds: [artistId], genreIds: [genreId] });

    const renamed = await call(`/admin/artists/${artistId}`, adminCookie, { method: "PATCH", body: { name: `${PREFIX} artista 2` } });
    expect(await json(renamed)).toMatchObject({ name: `${PREFIX} artista 2` });
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
