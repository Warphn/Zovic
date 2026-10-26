import { Playlist } from "../../domain/entities/playlist.ts";
import { HEX_COLOR_PATTERN } from "../../domain/shared/hex-color.ts";

const errorResponse = (code: string, message: string) => ({
  type: "object",
  required: ["error", "message"],
  properties: {
    error: { type: "string", example: code },
    message: { type: "string", example: message },
  },
});

// Formato de erro das rotas do Better Auth (o restante da API usa `error`, não `code`).
const authErrorResponse = (code: string, message: string) => ({
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string", example: code },
    message: { type: "string", example: message },
  },
});

// Nome do cookie sem o prefixo "__Secure-", que o Better Auth acrescenta com COOKIE_SECURE ligado.
const SESSION_COOKIE = "zovic.session_token";

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Zovic API",
    version: "0.1.0",
    description:
      "API do Zovic, streaming de músicas. A autenticação é feita pelo [Better Auth](https://www.better-auth.com), por sessão em cookie: `POST /api/auth/sign-in/email` (ou `/api/auth/sign-up/email`) define o cookie `zovic.session_token` (httpOnly), que o navegador envia nas próximas requisições. Os erros das rotas `/api/auth/*` têm o formato `{ code, message }`; os das demais rotas, `{ error, message }`.",
  },
  servers: [{ url: "/", description: "Esta API" }],
  tags: [
    { name: "Autenticação", description: "Cadastro, login, logout e sessão (Better Auth)" },
    { name: "Playlists", description: "Criação e gestão de playlists" },
    { name: "Infra", description: "Estado da API" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Infra"],
        summary: "Verifica se a API está no ar",
        operationId: "health",
        security: [],
        responses: {
          "200": { description: "API no ar" },
        },
      },
    },
    "/api/auth/sign-up/email": {
      post: {
        tags: ["Autenticação"],
        summary: "Cria uma conta e já abre a sessão",
        description:
          "Cadastra o usuário e responde com ele já logado: o cookie de sessão vem no `Set-Cookie`. O email é guardado em minúsculas e deve ser único. Limite: 10 cadastros por hora por IP.",
        operationId: "signUpEmail",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignUpRequest" },
              examples: {
                completo: {
                  summary: "Com data de nascimento",
                  value: {
                    name: "Ana Andrade",
                    email: "ana@exemplo.com",
                    password: "uma-senha-longa",
                    birthdate: "1995-03-12",
                  },
                },
                minimo: {
                  summary: "Sem data de nascimento",
                  value: { name: "Bruno Andrade", email: "bruno@exemplo.com", password: "outra-senha-1" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Conta criada e sessão aberta",
            headers: { "Set-Cookie": { $ref: "#/components/headers/SessionCookie" } },
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "400": {
            description:
              "Corpo inválido: campo ausente, email inválido, senha fora de 8 a 128 caracteres, nome fora de 1 a 150, data de nascimento inválida ou JSON malformado",
            content: {
              "application/json": {
                schema: authErrorResponse("VALIDATION_ERROR", "[body.email] Invalid email address"),
              },
            },
          },
          "422": {
            description: "Já existe uma conta com esse email",
            content: {
              "application/json": {
                schema: authErrorResponse(
                  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                  "User already exists. Use another email.",
                ),
              },
            },
          },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        tags: ["Autenticação"],
        summary: "Abre uma sessão com email e senha",
        description:
          "Em caso de sucesso, responde com o usuário e define o cookie de sessão. Email desconhecido, senha errada e conta removida dão a mesma resposta 401. Limite: 5 tentativas por 15 minutos por IP.",
        operationId: "signInEmail",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignInRequest" },
              examples: {
                teste: {
                  summary: "Usuário do seed local",
                  value: { email: "ana.andrade@zovic.test", password: "zovic123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Sessão aberta",
            headers: { "Set-Cookie": { $ref: "#/components/headers/SessionCookie" } },
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "401": {
            description: "Email ou senha inválidos",
            content: {
              "application/json": {
                schema: authErrorResponse("INVALID_EMAIL_OR_PASSWORD", "Invalid email or password"),
              },
            },
          },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        tags: ["Autenticação"],
        summary: "Encerra a sessão",
        description:
          "Apaga a sessão no servidor e limpa o cookie. Sem sessão, também responde 200. Como todo POST do Better Auth, exige o header `Origin` quando há cookie.",
        operationId: "signOut",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "Sessão encerrada e cookie limpo",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success"],
                  properties: { success: { type: "boolean", example: true } },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        tags: ["Autenticação"],
        summary: "Devolve a sessão e o usuário logado",
        description:
          "Se a sessão estiver na segunda metade da validade, ela é renovada e o cookie é reenviado. Sem sessão válida responde 200 com `null`.",
        operationId: "getSession",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Sessão e usuário, ou `null` sem sessão válida",
            content: {
              "application/json": {
                schema: {
                  oneOf: [{ $ref: "#/components/schemas/SessionResponse" }, { type: "null" }],
                },
              },
            },
          },
        },
      },
    },
    "/api/playlists": {
      post: {
        tags: ["Playlists"],
        summary: "Cria uma playlist",
        description:
          "Cria a playlist e adiciona o usuário autenticado como primeiro membro, com papel de admin. Nomes repetidos são permitidos. Campos fora do schema são ignorados.",
        operationId: "createPlaylist",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePlaylistRequest" },
              examples: {
                minima: { summary: "Só o nome", value: { name: "Rock nacional" } },
                completa: {
                  summary: "Com cor e privacidade",
                  value: { name: "Para estudar", isPrivate: true, color: "#1DB954" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Playlist criada",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Playlist" } },
            },
          },
          "400": {
            description: "Corpo inválido: campos fora do schema, regra do domínio violada ou JSON malformado",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/FieldValidationError" },
                    { $ref: "#/components/schemas/Error" },
                  ],
                },
                examples: {
                  campos: {
                    summary: "Campos inválidos (todos de uma vez)",
                    value: {
                      error: "VALIDATION_ERROR",
                      fields: [
                        { field: "name", message: '"name" is required' },
                        {
                          field: "color",
                          message: '"color" with value "azul" fails to match the required pattern: /^#[0-9A-Fa-f]{6}$/',
                        },
                      ],
                    },
                  },
                  json: {
                    summary: "JSON malformado",
                    value: { error: "INVALID_JSON", message: "Request body is not valid JSON" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Sem sessão válida: cookie ausente, inválido ou expirado, ou usuário removido",
            content: {
              "application/json": {
                schema: errorResponse("UNAUTHENTICATED", "Authentication required"),
              },
            },
          },
          "500": {
            description: "Erro inesperado. O detalhe fica só no log do servidor",
            content: {
              "application/json": { schema: errorResponse("INTERNAL_ERROR", "Internal server error") },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: SESSION_COOKIE,
        description:
          "Cookie de sessão (httpOnly, SameSite=Lax), definido por `/api/auth/sign-in/email` e `/api/auth/sign-up/email`. Dura 30 dias e é renovado quando resta menos da metade. Com `COOKIE_SECURE` ligado (padrão), o nome ganha o prefixo `__Secure-` e o cookie só trafega em HTTPS.",
      },
    },
    headers: {
      SessionCookie: {
        description: `Define \`${SESSION_COOKIE}\` (httpOnly, SameSite=Lax, Secure conforme \`COOKIE_SECURE\`).`,
        schema: {
          type: "string",
          example: `${SESSION_COOKIE}=abc123.assinatura; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
        },
      },
    },
    responses: {
      TooManyRequests: {
        description: "Limite de tentativas excedido. O header `X-Retry-After` diz quantos segundos esperar",
        headers: {
          "X-Retry-After": {
            description: "Segundos até poder tentar de novo",
            schema: { type: "integer", example: 900 },
          },
        },
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { message: { type: "string", example: "Too many requests. Please try again later." } },
            },
          },
        },
      },
    },
    schemas: {
      SignUpRequest: {
        type: "object",
        required: ["name", "email", "password", "birthdate"],
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 150,
            example: "Ana Andrade",
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 254,
            description: "Guardado em minúsculas.",
            example: "ana@exemplo.com",
          },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 128,
            format: "password",
          },
          birthdate: {
            type: "string",
            format: "date",
            description: "Obrigatória, no formato YYYY-MM-DD, uma data que não esteja no futuro. Não pode ser trocada depois.",
            example: "1995-03-12",
          },
        },
      },
      SignInRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "ana.andrade@zovic.test" },
          password: { type: "string", maxLength: 128, format: "password" },
        },
      },
      User: {
        type: "object",
        required: ["id", "name", "email", "emailVerified", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", description: "Id numérico do usuário, em texto.", example: "1" },
          name: { type: "string", example: "Ana Andrade" },
          email: { type: "string", example: "ana.andrade@zovic.test" },
          emailVerified: { type: "boolean", example: false },
          image: { type: ["string", "null"] },
          birthdate: { type: ["string", "null"], format: "date", example: "1995-03-12" },
          role: {
            type: "string",
            enum: ["admin", "assinante"],
            description: "Papel na plataforma. Toda conta nasce assinante; só o banco promove a admin.",
            example: "assinante",
          },
          deletedAt: {
            type: ["string", "null"],
            format: "date-time",
            description: "Preenchido só em usuários removidos (soft delete).",
          },
          createdAt: { type: "string", format: "date-time", example: "2026-01-05T12:00:00.000Z" },
          updatedAt: { type: "string", format: "date-time", example: "2026-01-05T12:00:00.000Z" },
        },
      },
      Session: {
        type: "object",
        description: "O token da sessão não é devolvido: ele só circula no cookie httpOnly.",
        required: ["id", "userId", "expiresAt", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", example: "7" },
          userId: { type: "string", example: "1" },
          expiresAt: { type: "string", format: "date-time" },
          ipAddress: { type: ["string", "null"] },
          userAgent: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        description: "A sessão vai só no cookie httpOnly (Set-Cookie); o token não aparece no corpo.",
        required: ["user"],
        properties: {
          user: { $ref: "#/components/schemas/User" },
        },
      },
      SessionResponse: {
        type: "object",
        required: ["session", "user"],
        properties: {
          session: { $ref: "#/components/schemas/Session" },
          user: {
            allOf: [
              { $ref: "#/components/schemas/User" },
              {
                type: "object",
                required: ["isAdult"],
                properties: {
                  isAdult: {
                    type: "boolean",
                    description:
                      "Maior de idade (18 anos completos, pelo dia de São Paulo), calculado a cada requisição. Sem data de nascimento, false.",
                  },
                },
              },
            ],
          },
        },
      },
      CreatePlaylistRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: Playlist.MAX_NAME_LENGTH,
            description: "Espaços nas pontas são removidos antes de validar.",
            example: "Rock nacional",
          },
          isPrivate: {
            type: "boolean",
            default: false,
            description: "Playlists nascem públicas.",
          },
          color: {
            type: ["string", "null"],
            pattern: HEX_COLOR_PATTERN.source,
            description: "Cor no formato #RRGGBB. É devolvida em maiúsculas.",
            example: "#1DB954",
          },
        },
      },
      Playlist: {
        type: "object",
        required: ["id", "name", "isPrivate", "color", "createdAt"],
        properties: {
          id: { type: "integer", example: 42 },
          name: { type: "string", example: "Rock nacional" },
          isPrivate: { type: "boolean", example: false },
          color: { type: ["string", "null"], example: "#1DB954" },
          createdAt: { type: "string", format: "date-time", example: "2026-10-13T19:25:03.445Z" },
        },
      },
      FieldValidationError: {
        type: "object",
        required: ["error", "fields"],
        properties: {
          error: { type: "string", const: "VALIDATION_ERROR" },
          fields: {
            type: "array",
            items: {
              type: "object",
              required: ["field", "message"],
              properties: {
                field: { type: "string", example: "name" },
                message: { type: "string", example: '"name" is required' },
              },
            },
          },
        },
      },
      Error: errorResponse("VALIDATION_ERROR", "Playlist name cannot be empty"),
    },
  },
};
