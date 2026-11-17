import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool, types } from "pg";
import { createAuth } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";

// Moderação de comentários (HU-23 e HU-39) pela app Express real (composeApp), com sessão do Better
// Auth e o banco de verdade. O pool lê `date` como "AAAA-MM-DD", como o de infra/db/pool.ts: os casos
// de uso de comentário buscam a data de nascimento no UserRepository, e o isMinor só entende esse formato.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  types: {
    getTypeParser: (oid, format) =>
      oid === types.builtins.DATE ? (value: string) => value : types.getTypeParser(oid, format),
  },
});

const ORIGIN = "http://localhost:3000";
const EMAIL_DOMAIN = "@comment-moderation.zovic.test";
const MUSIC_NAME = "Música do teste de moderação de comentários";

interface Account {
  id: number;
  cookie: string;
}

interface ReportedComment {
  id: number;
  comment: string;
  author: { id: number; name: string };
  music: { id: number; name: string };
  reportCount: number;
  reports: { reason: string; reporterName: string; createdAt: string }[];
}

let server: Server;
let baseUrl: string;
let musicId: number;
let admin: Account;
let author: Account;
let reporter: Account;

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
    body: JSON.stringify({ name: `Teste ${label}`, email, password: "uma-senha-longa", birthdate: "1995-03-12" }),
  });
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) throw new Error(`Sign-up failed with ${res.status}`);
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM "user" WHERE email = $1', [email]);
  return { id: rows[0]!.id, cookie: raw.split(";")[0]! };
}

async function insertComment(text: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO comments (music_id, user_id, comment) VALUES ($1, $2, $3) RETURNING id",
    [musicId, author.id, text],
  );
  return rows[0]!.id;
}

async function reportedComments(): Promise<ReportedComment[]> {
  const res = await call("GET", "/admin/comment-reports", admin.cookie);
  expect(res.status).toBe(200);
  return json<ReportedComment[]>(res);
}

async function removal(commentId: number): Promise<{ deletedAt: Date | null; deletedBy: number | null }> {
  const { rows } = await pool.query<{ deleted_at: Date | null; deleted_by: number | null }>(
    "SELECT deleted_at, deleted_by FROM comments WHERE id = $1",
    [commentId],
  );
  return { deletedAt: rows[0]!.deleted_at, deletedBy: rows[0]!.deleted_by };
}

beforeAll(async () => {
  const auth = createAuth(pool, {
    secret: "comment-moderation-routes-test-secret-32",
    baseURL: "http://localhost:3333",
    trustedOrigins: [ORIGIN],
    cookieSecure: false,
    rateLimit: false,
  });
  server = composeApp(auth, null, [ORIGIN], pool).listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const { rows } = await pool.query<{ id: number }>("INSERT INTO musics (name, duration) VALUES ($1, 180) RETURNING id", [
    MUSIC_NAME,
  ]);
  musicId = rows[0]!.id;
  admin = await createAccount("admin");
  await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [admin.id]);
  author = await createAccount("autor");
  reporter = await createAccount("denuncia");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Apagar a música apaga os comentários, e os comentários levam as denúncias (ON DELETE CASCADE)
  await pool.query("DELETE FROM musics WHERE name = $1", [MUSIC_NAME]);
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
  await pool.end();
});

describe("Moderação de comentários", () => {
  it("critério 3 da HU-23: só o admin da plataforma lista denúncias e remove comentários", async () => {
    const commentId = await insertComment("Comentário qualquer");

    expect((await call("GET", "/admin/comment-reports", reporter.cookie)).status).toBe(403);
    expect((await call("DELETE", `/admin/comments/${commentId}`, reporter.cookie)).status).toBe(403);
    expect((await removal(commentId)).deletedAt).toBeNull();
  });

  it("a lista mostra só os comentários denunciados, com o autor, a música e os motivos", async () => {
    const reportedId = await insertComment("Comentário ofensivo");
    const quietId = await insertComment("Comentário tranquilo");
    expect((await call("POST", `/comments/${reportedId}/reports`, reporter.cookie, { reason: "Discurso de ódio" })).status).toBe(201);

    const reported = await reportedComments();
    const item = reported.find((comment) => comment.id === reportedId);

    expect(reported.some((comment) => comment.id === quietId)).toBe(false);
    expect(item).toMatchObject({
      comment: "Comentário ofensivo",
      author: { id: author.id, name: "Teste autor" },
      music: { id: musicId, name: MUSIC_NAME },
      reportCount: 1,
    });
    expect(item?.reports[0]).toMatchObject({ reason: "Discurso de ódio", reporterName: "Teste denuncia" });
  });

  it("critérios 1 e 2 da HU-23: o comentário removido some para todos, e o banco guarda a data e o admin", async () => {
    const commentId = await insertComment("Para remover");
    await call("POST", `/comments/${commentId}/reports`, reporter.cookie, { reason: "Spam" });

    expect((await call("DELETE", `/admin/comments/${commentId}`, admin.cookie)).status).toBe(204);

    const listed = await json<{ id: number }[]>(await call("GET", `/musics/${musicId}/comments`, reporter.cookie));
    expect(listed.some((comment) => comment.id === commentId)).toBe(false);
    expect((await reportedComments()).some((comment) => comment.id === commentId)).toBe(false);
    const { deletedAt, deletedBy } = await removal(commentId);
    expect(deletedAt).not.toBeNull();
    expect(deletedBy).toBe(admin.id);
  });

  it("remover comentário inexistente, já removido ou com id inválido dá 404, como nas outras rotas de admin", async () => {
    const commentId = await insertComment("Removido duas vezes");
    await call("DELETE", `/admin/comments/${commentId}`, admin.cookie);

    expect((await call("DELETE", `/admin/comments/${commentId}`, admin.cookie)).status).toBe(404);
    expect((await call("DELETE", "/admin/comments/2147483647", admin.cookie)).status).toBe(404);
    expect((await call("DELETE", "/admin/comments/abc", admin.cookie)).status).toBe(404);
  });

  it("o autor apaga o próprio comentário e fica registrado como quem removeu", async () => {
    const commentId = await insertComment("Mudei de ideia");

    expect((await call("DELETE", `/comments/${commentId}`, author.cookie)).status).toBe(204);

    expect((await removal(commentId)).deletedBy).toBe(author.id);
  });
});
