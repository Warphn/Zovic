import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";

// Rotas de playlist pela app Express real (composeApp), com sessão do Better Auth e o banco de verdade.
// Pool próprio: o singleton de infra/db/pool.ts é encerrado pelo auth-flow.test.ts, que roda no mesmo processo.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@playlist-routes.zovic.test";

interface PlaylistBody {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  createdAt: string;
  isAdmin: boolean;
}

let server: Server;
let baseUrl: string;
let ana: string;
let bruno: string;

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
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
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

async function create(cookie: string, body: Record<string, unknown>): Promise<PlaylistBody> {
  const res = await call("POST", "/playlists", cookie, body);
  expect(res.status).toBe(201);
  return json<PlaylistBody>(res);
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "playlist-routes-test-secret-with-32-chars",
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
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.query(
    `DELETE FROM playlists WHERE id IN (
       SELECT pu.playlist_id FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.end();
});

describe("rotas de playlist", () => {
  it("exigem sessão", async () => {
    expect((await call("GET", "/playlists", null)).status).toBe(401);
    expect((await call("GET", "/playlists/1", null)).status).toBe(401);
    expect((await call("PATCH", "/playlists/1", null, { name: "x" })).status).toBe(401);
    expect((await call("DELETE", "/playlists/1", null)).status).toBe(401);
  });

  it("GET /playlists lista só as playlists do usuário, da mais nova para a mais antiga", async () => {
    const primeira = await create(ana, { name: "Primeira" });
    const segunda = await create(ana, { name: "Segunda" });
    const doBruno = await create(bruno, { name: "Do Bruno" });

    const res = await call("GET", "/playlists", ana);
    const ids = (await json<PlaylistBody[]>(res)).map((p) => p.id);

    expect(res.status).toBe(200);
    expect(ids.indexOf(segunda.id)).toBeLessThan(ids.indexOf(primeira.id));
    expect(ids).toContain(primeira.id);
    expect(ids).not.toContain(doBruno.id);
  });

  it("GET /playlists/:id mostra a pública a outros usuários e esconde a privada com 404", async () => {
    const publica = await create(ana, { name: "Pública" });
    const privada = await create(ana, { name: "Privada", isPrivate: true });

    const comoAna = await json<PlaylistBody>(await call("GET", `/playlists/${privada.id}`, ana));
    const publicaComoBruno = await call("GET", `/playlists/${publica.id}`, bruno);
    const privadaComoBruno = await call("GET", `/playlists/${privada.id}`, bruno);

    expect(comoAna).toMatchObject({ id: privada.id, isPrivate: true, isAdmin: true });
    expect(publicaComoBruno.status).toBe(200);
    expect((await json<PlaylistBody>(publicaComoBruno)).isAdmin).toBe(false);
    expect(privadaComoBruno.status).toBe(404);
    expect((await json<{ error: string }>(privadaComoBruno)).error).toBe("NOT_FOUND");
  });

  it("recusa id que não é inteiro positivo com 400", async () => {
    for (const id of ["abc", "0", "-1", "1.5", "01", "99999999999"]) {
      const res = await call("GET", `/playlists/${id}`, ana);
      expect(res.status).toBe(400);
      expect((await json<{ fields: { field: string }[] }>(res)).fields[0]?.field).toBe("id");
    }
  });

  it("PATCH /playlists/:id altera só os campos enviados", async () => {
    const playlist = await create(ana, { name: "Rock", color: "#112233" });

    const res = await call("PATCH", `/playlists/${playlist.id}`, ana, { name: "  Rock nacional  ", isPrivate: true });
    const body = await json<PlaylistBody>(res);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: "Rock nacional", isPrivate: true, color: "#112233", isAdmin: true });

    const semCor = await json<PlaylistBody>(await call("PATCH", `/playlists/${playlist.id}`, ana, { color: null }));
    expect(semCor.color).toBeNull();
  });

  it("PATCH recusa corpo vazio ou inválido com 400", async () => {
    const playlist = await create(ana, { name: "Rock" });

    expect((await call("PATCH", `/playlists/${playlist.id}`, ana, {})).status).toBe(400);
    expect((await call("PATCH", `/playlists/${playlist.id}`, ana, { color: "azul" })).status).toBe(400);
    expect((await call("PATCH", `/playlists/${playlist.id}`, ana, { name: "   " })).status).toBe(400);
  });

  it("PATCH e DELETE de quem não é admin dão 403 numa pública e 404 numa privada", async () => {
    const publica = await create(ana, { name: "Pública" });
    const privada = await create(ana, { name: "Privada", isPrivate: true });

    expect((await call("PATCH", `/playlists/${publica.id}`, bruno, { name: "Invasão" })).status).toBe(403);
    expect((await call("DELETE", `/playlists/${publica.id}`, bruno)).status).toBe(403);
    expect((await call("PATCH", `/playlists/${privada.id}`, bruno, { name: "Invasão" })).status).toBe(404);
    expect((await call("DELETE", `/playlists/${privada.id}`, bruno)).status).toBe(404);
  });

  it("DELETE /playlists/:id apaga com soft delete, e apagar de novo dá 404", async () => {
    const playlist = await create(ana, { name: "Para apagar" });

    const res = await call("DELETE", `/playlists/${playlist.id}`, ana);

    expect(res.status).toBe(204);
    expect((await call("GET", `/playlists/${playlist.id}`, ana)).status).toBe(404);
    expect((await call("DELETE", `/playlists/${playlist.id}`, ana)).status).toBe(404);
    const { rows } = await pool.query("SELECT deleted_at FROM playlists WHERE id = $1", [playlist.id]);
    expect(rows[0]?.deleted_at).toBeInstanceOf(Date);
  });
});
