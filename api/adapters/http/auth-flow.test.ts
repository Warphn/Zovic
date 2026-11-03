import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createAuth } from "../auth/create-auth.ts";
import type { AuthOptions } from "../auth/create-auth.ts";
import { composeApp } from "../../infra/composition-root.ts";
import { pool } from "../../infra/db/pool.ts";

// Fluxo de autenticação pela app Express real (composeApp), com o Better Auth e o banco de verdade.

const ORIGIN = "http://localhost:3000";
const PASSWORD = "uma-senha-longa";
const EMAIL_DOMAIN = "@auth-flow.zovic.test";

const baseOptions: AuthOptions = {
  secret: "auth-flow-test-secret-with-32-chars-minimum",
  baseURL: "http://localhost:3333",
  trustedOrigins: [ORIGIN],
  cookieSecure: false,
  rateLimit: false,
};

interface TestApp {
  url: string;
  server: Server;
}

function startApp(options: Partial<AuthOptions>, trustProxy: number | null = null): TestApp {
  const app = composeApp(createAuth(pool, { ...baseOptions, ...options }), trustProxy);
  const server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server has no port");
  }
  return { url: `http://127.0.0.1:${address.port}`, server };
}

async function stopApp({ server }: TestApp): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

interface Body {
  code?: string;
  error?: string;
  id?: number;
  name?: string;
  user: { id: string; email: string; birthdate: string | null };
}

async function bodyOf(res: Response): Promise<Body> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as Body;
}

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
}

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  };
}

/** "nome=valor; Path=/; HttpOnly…" → { header: "nome=valor", name, attributes }. */
function sessionCookie(res: Response) {
  const raw = res.headers.getSetCookie().find((cookie) => /session_token=/.test(cookie));
  if (!raw) {
    return null;
  }
  const [pair = "", ...attributes] = raw.split(";").map((part) => part.trim());
  return { header: pair, name: pair.split("=")[0]!, value: pair.slice(pair.indexOf("=") + 1), attributes };
}

async function playlistsWith(app: TestApp, cookie: string | null, headers: Record<string, string> = {}) {
  return fetch(
    `${app.url}/api/playlists`,
    json({ name: "Auth flow" }, { ...(cookie ? { Cookie: cookie } : {}), ...headers }),
  );
}

async function signUp(app: TestApp, email: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${app.url}/api/auth/sign-up/email`, json({ name: "Teste Auth", email, password: PASSWORD, ...extra }));
  return { res, cookie: sessionCookie(res) };
}

async function signIn(app: TestApp, email: string, password: string, headers: Record<string, string> = {}) {
  return fetch(`${app.url}/api/auth/sign-in/email`, json({ email, password }, headers));
}

async function cleanup(): Promise<void> {
  await pool.query(
    `DELETE FROM playlists WHERE id IN (
       SELECT pu.playlist_id FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`],
  );
  // session e account saem junto, por ON DELETE CASCADE.
  await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%${EMAIL_DOMAIN}`]);
}

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("autenticação com Better Auth", () => {
  let app: TestApp;

  beforeAll(() => {
    app = startApp({});
  });

  afterAll(async () => {
    await stopApp(app);
  });

  describe("cadastro", () => {
    it("cria o usuário, abre a sessão e devolve o cookie httpOnly", async () => {
      const email = uniqueEmail("cadastro").toUpperCase();
      const { res, cookie } = await signUp(app, email, { birthdate: "1995-03-12" });

      expect(res.status).toBe(200);
      const body = await bodyOf(res);
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.birthdate).toBe("1995-03-12");
      expect(body.user.id).toMatch(/^\d+$/);
      expect(body.user).not.toHaveProperty("password");

      expect(cookie?.name).toBe("zovic.session_token");
      expect(cookie?.attributes).toContain("HttpOnly");
      expect(cookie?.attributes).toContain("SameSite=Lax");
      expect(cookie?.attributes).toContain("Path=/");
      expect(cookie?.attributes).not.toContain("Secure");
      expect(cookie?.attributes.some((attribute) => attribute.startsWith("Max-Age="))).toBe(true);
    });

    it("guarda o id inteiro, o email em minúsculas e só o hash da senha", async () => {
      const email = uniqueEmail("banco");
      const { res } = await signUp(app, email);
      const { user } = await bodyOf(res);

      const { rows } = await pool.query<{ id: number; email: string; password: string; account_id: string; provider_id: string }>(
        `SELECT u.id, u.email, a.password, a.account_id, a.provider_id
           FROM "user" u JOIN account a ON a.user_id = u.id WHERE u.email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(Number(user.id));
      expect(rows[0]!.provider_id).toBe("credential");
      expect(rows[0]!.account_id).toBe(user.id);
      expect(rows[0]!.password).not.toBe(PASSWORD);
      expect(rows[0]!.password).not.toContain(PASSWORD);
    });

    it("recusa email repetido, mesmo com outra caixa", async () => {
      const email = uniqueEmail("repetido");
      await signUp(app, email);
      const { res } = await signUp(app, email.toUpperCase());

      expect(res.status).toBe(422);
      expect((await bodyOf(res)).code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
    });

    it("recusa senha curta, senha longa demais e email inválido", async () => {
      expect((await signUp(app, uniqueEmail("curta"), { password: "1234567" })).res.status).toBe(400);
      expect((await signUp(app, uniqueEmail("longa"), { password: "a".repeat(129) })).res.status).toBe(400);
      expect((await signUp(app, "isso-nao-e-email")).res.status).toBe(400);
    });

    it("recusa nome em branco ou acima do limite do banco", async () => {
      expect((await signUp(app, uniqueEmail("vazio"), { name: "   " })).res.status).toBe(400);
      expect((await signUp(app, uniqueEmail("nome"), { name: "a".repeat(151) })).res.status).toBe(400);
    });

    it("recusa data de nascimento inválida ou no futuro", async () => {
      for (const birthdate of ["12/03/1995", "1995-02-30", "2999-01-01", "ontem"]) {
        const { res } = await signUp(app, uniqueEmail("nascimento"), { birthdate });
        expect(res.status).toBe(400);
      }
    });

    it("não deixa o cliente escolher deletedAt nem id", async () => {
      const { res } = await signUp(app, uniqueEmail("campos"), { deletedAt: new Date().toISOString(), id: "1" });

      expect(res.status).toBe(400);
    });
  });

  describe("sessão", () => {
    it("o cookie válido dá acesso a POST /api/playlists", async () => {
      const { cookie } = await signUp(app, uniqueEmail("sessao"));

      const res = await playlistsWith(app, cookie!.header);

      expect(res.status).toBe(201);
      expect((await bodyOf(res)).name).toBe("Auth flow");
    });

    it("a playlist fica ligada ao usuário da sessão", async () => {
      const email = uniqueEmail("dono");
      const { cookie } = await signUp(app, email);
      const playlist = await bodyOf(await playlistsWith(app, cookie!.header));

      const { rows } = await pool.query(
        `SELECT 1 FROM playlist_user pu JOIN "user" u ON u.id = pu.user_id
          WHERE pu.playlist_id = $1 AND u.email = $2 AND pu.is_admin`,
        [playlist.id, email],
      );
      expect(rows).toHaveLength(1);
    });

    it("sem cookie, com cookie inválido ou só com x-user-id responde 401", async () => {
      const expected = { error: "UNAUTHENTICATED", message: expect.any(String) };

      const semCookie = await playlistsWith(app, null);
      expect(semCookie.status).toBe(401);
      expect(await semCookie.json()).toEqual(expected);

      const invalido = await playlistsWith(app, "zovic.session_token=lixo.assinatura");
      expect(invalido.status).toBe(401);

      const legado = await playlistsWith(app, null, { "x-user-id": "1" });
      expect(legado.status).toBe(401);
    });

    it("get-session devolve o usuário da sessão", async () => {
      const email = uniqueEmail("getsession");
      const { cookie } = await signUp(app, email);

      const res = await fetch(`${app.url}/api/auth/get-session`, { headers: { Cookie: cookie!.header } });

      expect(res.status).toBe(200);
      expect((await bodyOf(res)).user.email).toBe(email);
    });

    it("renova a sessão na segunda metade da validade e reenvia o cookie", async () => {
      const email = uniqueEmail("renovacao");
      const { cookie } = await signUp(app, email);
      await pool.query(
        `UPDATE session SET expires_at = now() + interval '10 days'
          WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
        [email],
      );

      const res = await playlistsWith(app, cookie!.header);

      expect(res.status).toBe(201);
      expect(sessionCookie(res)?.value).toBe(cookie!.value);
      const { rows } = await pool.query<{ days: string }>(
        `SELECT extract(epoch FROM expires_at - now()) / 86400 AS days FROM session
          WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
        [email],
      );
      expect(Number(rows[0]!.days)).toBeGreaterThan(29);
    });

    it("sessão expirada responde 401", async () => {
      const email = uniqueEmail("expirada");
      const { cookie } = await signUp(app, email);
      await pool.query(
        `UPDATE session SET expires_at = now() - interval '1 minute'
          WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
        [email],
      );

      expect((await playlistsWith(app, cookie!.header)).status).toBe(401);
    });
  });

  describe("logout", () => {
    it("invalida a sessão no servidor, inclusive para quem guardou o cookie", async () => {
      const { cookie } = await signUp(app, uniqueEmail("logout"));
      expect((await playlistsWith(app, cookie!.header)).status).toBe(201);

      const out = await fetch(`${app.url}/api/auth/sign-out`, json({}, { Cookie: cookie!.header }));
      expect(out.status).toBe(200);
      expect(sessionCookie(out)?.attributes).toContain("Max-Age=0");

      expect((await playlistsWith(app, cookie!.header)).status).toBe(401);
    });
  });

  describe("login", () => {
    it("com a senha certa abre uma sessão nova", async () => {
      const email = uniqueEmail("login");
      await signUp(app, email);

      const res = await signIn(app, email.toUpperCase(), PASSWORD);

      expect(res.status).toBe(200);
      const cookie = sessionCookie(res);
      expect(cookie?.name).toBe("zovic.session_token");
      expect((await playlistsWith(app, cookie!.header)).status).toBe(201);
    });

    it("com a senha errada responde 401 e não abre sessão", async () => {
      const email = uniqueEmail("senha-errada");
      await signUp(app, email);

      const res = await signIn(app, email, "senha-errada-123");

      expect(res.status).toBe(401);
      expect(sessionCookie(res)).toBeNull();
      expect((await bodyOf(res)).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    });

    it("email desconhecido dá a mesma resposta que senha errada", async () => {
      const email = uniqueEmail("conhecido");
      await signUp(app, email);
      const wrongPassword = await signIn(app, email, "senha-errada-123");
      const unknownEmail = await signIn(app, uniqueEmail("desconhecido"), "senha-errada-123");

      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(await bodyOf(unknownEmail)).toEqual(await bodyOf(wrongPassword));
    });

    it("usuário sem email nem conta (anterior ao Better Auth) não consegue entrar", async () => {
      const { rows } = await pool.query<{ id: number }>(`INSERT INTO "user" (name) VALUES ('Sem login') RETURNING id`);
      try {
        const res = await signIn(app, "sem.login" + EMAIL_DOMAIN, PASSWORD);
        expect(res.status).toBe(401);
      } finally {
        await pool.query(`DELETE FROM "user" WHERE id = $1`, [rows[0]!.id]);
      }
    });
  });

  describe("usuário com soft delete", () => {
    it("não consegue entrar, com a mesma resposta de senha errada", async () => {
      const email = uniqueEmail("removido");
      await signUp(app, email);
      await pool.query(`UPDATE "user" SET deleted_at = now() WHERE email = $1`, [email]);

      const res = await signIn(app, email, PASSWORD);

      expect(res.status).toBe(401);
      expect(sessionCookie(res)).toBeNull();
      expect((await bodyOf(res)).code).toBe("INVALID_EMAIL_OR_PASSWORD");
      const { rows } = await pool.query(
        `SELECT 1 FROM session s JOIN "user" u ON u.id = s.user_id WHERE u.email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1); // só a sessão do cadastro
    });

    it("perde também a sessão que já estava aberta", async () => {
      const email = uniqueEmail("removido-logado");
      const { cookie } = await signUp(app, email);
      expect((await playlistsWith(app, cookie!.header)).status).toBe(201);

      await pool.query(`UPDATE "user" SET deleted_at = now() WHERE email = $1`, [email]);

      expect((await playlistsWith(app, cookie!.header)).status).toBe(401);
    });
  });
});

describe("cookie com COOKIE_SECURE ligado", () => {
  it("ganha Secure e o prefixo __Secure-", async () => {
    const app = startApp({ cookieSecure: true });
    try {
      const { cookie } = await signUp(app, uniqueEmail("secure"));

      expect(cookie?.name).toBe("__Secure-zovic.session_token");
      expect(cookie?.attributes).toContain("Secure");
      expect(cookie?.attributes).toContain("HttpOnly");
      expect(cookie?.attributes).toContain("SameSite=Lax");
    } finally {
      await stopApp(app);
    }
  });
});

describe("rate limit", () => {
  // trust proxy = 1: o IP do cliente vem do X-Forwarded-For, como atrás de um proxy reverso.
  it("bloqueia a 6ª tentativa de login do mesmo IP, sem separar por email nem ceder a cabeçalho forjado", async () => {
    const app = startApp({ rateLimit: true }, 1);
    try {
      const ip = { "X-Forwarded-For": "203.0.113.10" };
      const email = uniqueEmail("limite");

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const res = await signIn(app, email, "senha-errada-123", ip);
        expect(res.status).toBe(401);
      }
      const blocked = await signIn(app, email, "senha-errada-123", { ...ip, "x-zovic-client-ip": "198.51.100.77" });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("x-retry-after")).toMatch(/^\d+$/);

      // Outro email, mesmo IP: também bloqueado.
      expect((await signIn(app, uniqueEmail("outro"), "senha-errada-123", ip)).status).toBe(429);
      // Outro IP: livre.
      expect((await signIn(app, email, "senha-errada-123", { "X-Forwarded-For": "203.0.113.11" })).status).toBe(401);
    } finally {
      await stopApp(app);
    }
  });

  it("limita o cadastro a 10 por hora por IP", async () => {
    const app = startApp({ rateLimit: true }, 1);
    try {
      const ip = { "X-Forwarded-For": "203.0.113.20" };
      const statuses: number[] = [];
      for (let attempt = 1; attempt <= 11; attempt += 1) {
        const res = await fetch(
          `${app.url}/api/auth/sign-up/email`,
          json({ name: "Limite", email: uniqueEmail("cadastros"), password: PASSWORD }, ip),
        );
        statuses.push(res.status);
      }

      expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      await stopApp(app);
    }
  });
});
