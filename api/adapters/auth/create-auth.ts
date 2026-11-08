import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { customSession } from "better-auth/plugins";
import type { Pool } from "pg";
import Joi from "joi";
import { DomainError } from "../../domain/errors/domain-error.ts";
import { calendarDateIn, isAdult, TIME_ZONE } from "../../domain/shared/age.ts";
import { INVITATION_TOKEN_MAX_LENGTH, normalizeEmail } from "../../domain/shared/plan-invitation.ts";
import { AcceptInvitation } from "../../domain/use-cases/accept-invitation.ts";
import { GetInvitation } from "../../domain/use-cases/get-invitation.ts";
import { PostgresSubscriptionRepository } from "../db/postgres-subscription-repository.ts";

export interface AuthOptions {
  /** Segredo de assinatura/criptografia do Better Auth (mínimo de 32 caracteres). */
  secret: string;
  /** URL pública da API, sem o /api/auth (ex.: http://localhost:3333). */
  baseURL: string;
  /** Origens do frontend autorizadas a chamar a API com o cookie. */
  trustedOrigins: string[];
  /** Cookie com o atributo Secure (e o prefixo __Secure- no nome). */
  cookieSecure: boolean;
  /** Liga o rate limit embutido (limites de sign-in e sign-up). */
  rateLimit: boolean;
}

/**
 * Cabeçalho que o Express preenche com o IP do cliente (req.ip, já considerando TRUST_PROXY).
 * O Better Auth lê o IP só daqui para o rate limit; um valor enviado pelo cliente é sempre sobrescrito.
 */
export const CLIENT_IP_HEADER = "x-zovic-client-ip";

const SIGN_UP_PATH = "/sign-up/email";
/** Campo extra do corpo do cadastro: o token do convite do plano familiar. */
const INVITATION_TOKEN_FIELD = "invitationToken";

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;
// Limites das colunas user.name e user.email.
export const NAME_MAX_LENGTH = 150;
export const EMAIL_MAX_LENGTH = 254;

// AAAA-MM-DD, uma data que existe no calendário e que não está no futuro.
export const birthdateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value: string, helpers) => {
    const date = new Date(`${value}T00:00:00Z`);
    const exists = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    if (!exists || date.getTime() > Date.now()) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "string.pattern.base": "birthdate must be a date in the format YYYY-MM-DD",
    "any.invalid": "birthdate must be a valid date that is not in the future",
  });

/** O token do convite enviado no cadastro: `undefined` se o campo não veio, `null` se veio com tipo ou tamanho inválido. */
function readInvitationToken(body: unknown): string | null | undefined {
  if (typeof body !== "object" || body === null || !(INVITATION_TOKEN_FIELD in body)) return undefined;
  const token = body[INVITATION_TOKEN_FIELD];
  if (typeof token !== "string" || token === "" || token.length > INVITATION_TOKEN_MAX_LENGTH) return null;
  return token;
}

const invalidInvitation = () =>
  APIError.from("BAD_REQUEST", {
    code: "INVALID_INVITATION",
    message: "The invitation is invalid, expired or was sent to another email",
  });

export function createAuth(pool: Pool, options: AuthOptions) {
  const subscriptions = new PostgresSubscriptionRepository(pool);
  const getInvitation = new GetInvitation(subscriptions);
  const acceptInvitation = new AcceptInvitation(subscriptions);

  /** Com token, ele precisa ser de um convite válido para o mesmo email; sem token, só adulto se cadastra. */
  async function requireInvitationForMinors(
    user: { email?: unknown; birthdate?: unknown },
    body: unknown,
  ): Promise<void> {
    const token = readInvitationToken(body);
    if (token === null) throw invalidInvitation();
    if (token === undefined) {
      const birthdate = typeof user.birthdate === "string" ? user.birthdate : null;
      if (!isAdult(birthdate, calendarDateIn(new Date(), TIME_ZONE))) {
        throw APIError.from("FORBIDDEN", {
          code: "MINOR_NEEDS_INVITATION",
          message: "Minors can only sign up with a family plan invitation",
        });
      }
      return;
    }
    try {
      const invitation = await getInvitation.execute({ token });
      if (typeof user.email !== "string" || normalizeEmail(user.email) !== invitation.email) throw invalidInvitation();
    } catch (error) {
      if (error instanceof DomainError) throw invalidInvitation();
      throw error;
    }
  }

  const config = {
    appName: "Zovic",
    database: pool,
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,

    // O Flyway é dono do schema (db/migrations): os ids são inteiros gerados pelo banco
    // e os nomes seguem o snake_case do resto do SQL.
    advanced: {
      database: { generateId: "serial" },
      useSecureCookies: options.cookieSecure,
      cookiePrefix: "zovic",
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
    },

    session: {
      modelName: "session",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      expiresIn: 30 * DAY,
      updateAge: 15 * DAY,
    },

    user: {
      modelName: "user",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        // Obrigatória no cadastro (issue #1: toda conta tem idade). A coluna continua aceitando
        // NULL por causa dos usuários anteriores ao Better Auth; para eles, isAdult é false.
        birthdate: {
          type: "string",
          required: true,
          input: true,
          validator: { input: birthdateSchema },
        },
        // admin | assinante. Só o banco muda: input false faz o cadastro recusar o campo.
        role: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "assinante",
        },
        // Soft delete: só o banco escreve. Fica visível na resposta para o
        // middleware authenticate recusar sessões de usuários removidos.
        deletedAt: {
          type: "date",
          required: false,
          input: false,
          fieldName: "deleted_at",
        },
      },
    },

    account: {
      modelName: "account",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },

    verification: {
      modelName: "verification",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },

    // A rota de alterar o usuário mudaria a data de nascimento (um menor viraria maior de idade)
    // e nenhuma tela a usa. Fica desligada até existir uma regra para isso.
    disabledPaths: ["/update-user"],

    rateLimit: {
      enabled: options.rateLimit,
      storage: "memory",
      customRules: {
        "/sign-in/email": { window: 15 * MINUTE, max: 5 },
        "/sign-up/email": { window: 60 * MINUTE, max: 10 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            const name = typeof user.name === "string" ? user.name.trim() : "";
            if (name === "" || name.length > NAME_MAX_LENGTH) {
              throw APIError.from("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: `name must have between 1 and ${NAME_MAX_LENGTH} characters`,
              });
            }
            if (typeof user.email === "string" && user.email.length > EMAIL_MAX_LENGTH) {
              throw APIError.from("BAD_REQUEST", {
                code: "INVALID_EMAIL",
                message: `email must have at most ${EMAIL_MAX_LENGTH} characters`,
              });
            }
            if (context?.path === SIGN_UP_PATH) {
              await requireInvitationForMinors(user, context.body);
            }
            return { data: { ...user, name } };
          },
          // Roda depois do commit do cadastro. Se o convite foi cancelado nesse intervalo, a conta
          // continua existindo, sem plano, e o cadastro não deve falhar por isso.
          after: async (user, context) => {
            if (context?.path !== SIGN_UP_PATH) return;
            const token = readInvitationToken(context.body);
            if (typeof token !== "string") return;
            try {
              await acceptInvitation.execute({ token, userId: Number(user.id), email: user.email });
            } catch (error) {
              if (!(error instanceof DomainError)) throw error;
            }
          },
        },
      },
      session: {
        create: {
          // Usuário com soft delete não abre sessão. A mensagem é a mesma de senha errada.
          before: async (session, context) => {
            // Pelo adapter do Better Auth, que enxerga o usuário recém-criado dentro da transação do cadastro.
            const user = await context?.context.internalAdapter.findUserById(session.userId);
            if (!user || ("deletedAt" in user && user.deletedAt)) {
              throw APIError.from("UNAUTHORIZED", {
                code: "INVALID_EMAIL_OR_PASSWORD",
                message: "Invalid email or password",
              });
            }
          },
        },
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth({
    ...config,
    plugins: [
      // A sessão devolvida ao cliente diz se o usuário é maior de idade, calculado agora (um
      // valor gravado ficaria velho no aniversário). Recebe o config para tipar os campos extras.
      customSession(
        async ({ user, session }) => ({
          user: { ...user, isAdult: isAdult(user.birthdate ?? null, calendarDateIn(new Date(), TIME_ZONE)) },
          session,
        }),
        config,
      ),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
