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
      "API do Zovic, streaming de músicas.\n\n" +
      "**Autenticação.** É feita pelo [Better Auth](https://www.better-auth.com), por sessão em cookie: `POST /api/auth/sign-in/email` (ou `/api/auth/sign-up/email`) define o cookie `zovic.session_token` (httpOnly), que o navegador envia nas próximas requisições. Fora `/api/auth/*` e `/health`, toda rota exige a sessão e responde 401 sem ela.\n\n" +
      "**Testando por esta página.** Rode o `sign-in` em *Try it out*: o navegador guarda o cookie e as próximas chamadas daqui já vão autenticadas. O botão *Authorize* não é necessário (e não funciona com cookie: o navegador não deixa a página definir o cookie). Para isso a API precisa de `COOKIE_SECURE=false` quando roda em `http://`, e esta página deve ser aberta pelo mesmo endereço de `BETTER_AUTH_URL` (padrão `http://localhost:3333`). Com o seed LOCAL, todo usuário entra com `nome.sobrenome@zovic.test` e a senha `zovic123`.\n\n" +
      "**Erros.** As rotas `/api/auth/*` respondem `{ code, message }`; as demais, `{ error, message }`, ou `{ error: \"VALIDATION_ERROR\", fields }` quando a validação aponta campos.",
  },
  servers: [{ url: "/", description: "Esta API" }],
  tags: [
    { name: "Autenticação", description: "Cadastro, login, logout e sessão (Better Auth)" },
    { name: "Playlists", description: "Criação e gestão de playlists" },
    { name: "Busca", description: "Busca de músicas, artistas e playlists" },
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
              example: {
                name: "Ana Andrade",
                email: "ana@exemplo.com",
                password: "uma-senha-longa",
                birthdate: "1995-03-12",
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
              "Corpo inválido: campo ausente (inclusive `birthdate`), email inválido, senha fora de 8 a 128 caracteres, nome fora de 1 a 150, data de nascimento inválida ou no futuro, ou JSON malformado",
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
      get: {
        tags: ["Playlists"],
        summary: "Lista as playlists do usuário",
        description:
          "As playlists ativas de que o usuário autenticado é membro, da mais nova para a mais antiga. `isAdmin` diz se ele pode editá-las e apagá-las.",
        operationId: "listMyPlaylists",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Playlists do usuário (lista vazia se não houver nenhuma)",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Playlist" } },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
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
            description: "Corpo inválido: nome ausente, vazio ou longo demais, cor fora do formato #RRGGBB, regra do domínio violada ou JSON malformado",
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
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/playlists/{id}": {
      parameters: [{ $ref: "#/components/parameters/PlaylistId" }],
      get: {
        tags: ["Playlists"],
        summary: "Mostra uma playlist",
        description:
          "Qualquer usuário autenticado vê uma playlist pública; uma privada, só os membros. A privada de outra pessoa responde 404, como se não existisse.",
        operationId: "getPlaylist",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "A playlist",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Playlist" } } },
          },
          "400": { $ref: "#/components/responses/InvalidPlaylistId" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "404": { $ref: "#/components/responses/PlaylistNotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      patch: {
        tags: ["Playlists"],
        summary: "Edita uma playlist",
        description:
          "Só admins da playlist. Muda apenas os campos enviados; pelo menos um é obrigatório. `color: null` apaga a cor.",
        operationId: "updatePlaylist",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePlaylistRequest" },
              examples: {
                renomear: { summary: "Só o nome", value: { name: "Rock nacional" } },
                privada: { summary: "Tornar privada e tirar a cor", value: { isPrivate: true, color: null } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Playlist atualizada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Playlist" } } },
          },
          "400": {
            description: "Id ou corpo inválido, corpo vazio, regra do domínio violada ou JSON malformado",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/FieldValidationError" },
                    { $ref: "#/components/schemas/Error" },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlaylistAdmin" },
          "404": { $ref: "#/components/responses/PlaylistNotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Playlists"],
        summary: "Apaga uma playlist",
        description:
          "Só admins da playlist. Soft delete: a playlist some das listagens e das buscas. Apagar de novo responde 404.",
        operationId: "deletePlaylist",
        security: [{ cookieAuth: [] }],
        responses: {
          "204": { description: "Playlist apagada" },
          "400": { $ref: "#/components/responses/InvalidPlaylistId" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlaylistAdmin" },
          "404": { $ref: "#/components/responses/PlaylistNotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/search": {
      get: {
        tags: ["Busca"],
        summary: "Busca músicas, artistas e playlists",
        description:
          "Procura o termo no catálogo inteiro, sem diferenciar maiúsculas nem acentos (`agua` acha `Águas`), e devolve até `limit` itens de cada grupo. Em cada grupo vêm primeiro os nomes que começam com o termo, depois os que têm uma palavra começando com ele, depois os que só o contêm; empates em ordem alfabética. Músicas também são encontradas pelo nome dos artistas. Playlists: as públicas de qualquer pessoa e as privadas de que o usuário é membro. `%` e `_` são texto, não curinga. Nada apagado aparece.",
        operationId: "search",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            description: "Termo buscado, de 1 a 100 caracteres depois de tirar os espaços das pontas.",
            schema: { type: "string", minLength: 1, maxLength: 100, example: "agua" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Máximo de itens em cada grupo.",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 5, example: 4 },
          },
        ],
        responses: {
          "200": {
            description: "Resultados agrupados por tipo (grupos vazios quando nada casa)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResults" } } },
          },
          "400": {
            description: "`q` ausente, vazio ou longo demais, ou `limit` fora de 1 a 50",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FieldValidationError" },
                example: { error: "VALIDATION_ERROR", fields: [{ field: "q", message: '"q" is required' }] },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
  components: {
    parameters: {
      PlaylistId: {
        name: "id",
        in: "path",
        required: true,
        description: "Id da playlist: inteiro positivo, sem zero à esquerda.",
        schema: { type: "integer", minimum: 1, maximum: 2_147_483_647, example: 42 },
      },
    },
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
      Unauthenticated: {
        description: "Sem sessão válida: cookie ausente, inválido ou expirado, ou usuário removido",
        content: {
          "application/json": { schema: errorResponse("UNAUTHENTICATED", "Authentication required") },
        },
      },
      InvalidPlaylistId: {
        description: "O id da URL não é um inteiro positivo",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/FieldValidationError" },
            example: { error: "VALIDATION_ERROR", fields: [{ field: "id", message: '"id" must be a positive integer' }] },
          },
        },
      },
      PlaylistNotFound: {
        description: "A playlist não existe, foi apagada, ou é privada e o usuário não é membro",
        content: {
          "application/json": { schema: errorResponse("NOT_FOUND", "Playlist not found") },
        },
      },
      NotPlaylistAdmin: {
        description: "O usuário vê a playlist, mas não é admin dela",
        content: {
          "application/json": { schema: errorResponse("FORBIDDEN", "Only playlist admins can edit it") },
        },
      },
      InternalError: {
        description: "Erro inesperado. O detalhe fica só no log do servidor",
        content: {
          "application/json": { schema: errorResponse("INTERNAL_ERROR", "Internal server error") },
        },
      },
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
      UpdatePlaylistRequest: {
        type: "object",
        minProperties: 1,
        description: "Só os campos enviados mudam; pelo menos um é obrigatório.",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: Playlist.MAX_NAME_LENGTH,
            description: "Espaços nas pontas são removidos antes de validar.",
            example: "Rock nacional",
          },
          isPrivate: { type: "boolean" },
          color: {
            type: ["string", "null"],
            pattern: HEX_COLOR_PATTERN.source,
            description: "Cor no formato #RRGGBB, ou null para apagar a cor.",
            example: "#1DB954",
          },
        },
      },
      Playlist: {
        type: "object",
        required: ["id", "name", "isPrivate", "color", "createdAt", "isAdmin"],
        properties: {
          id: { type: "integer", example: 42 },
          name: { type: "string", example: "Rock nacional" },
          isPrivate: { type: "boolean", example: false },
          color: { type: ["string", "null"], example: "#1DB954" },
          createdAt: { type: "string", format: "date-time", example: "2026-10-13T19:25:03.445Z" },
          isAdmin: {
            type: "boolean",
            description: "Se o usuário autenticado é admin da playlist, ou seja, se pode editá-la e apagá-la.",
            example: true,
          },
        },
      },
      SearchResults: {
        type: "object",
        required: ["musics", "artists", "playlists"],
        properties: {
          musics: { type: "array", items: { $ref: "#/components/schemas/MusicHit" } },
          artists: { type: "array", items: { $ref: "#/components/schemas/ArtistHit" } },
          playlists: { type: "array", items: { $ref: "#/components/schemas/PlaylistHit" } },
        },
      },
      MusicHit: {
        type: "object",
        required: ["id", "name", "duration", "artists"],
        properties: {
          id: { type: "integer", example: 12 },
          name: { type: "string", example: "Águas de Março" },
          duration: { type: "integer", description: "Duração em segundos.", example: 212 },
          artists: {
            type: "array",
            description: "Artistas ativos da música, em ordem alfabética.",
            items: {
              type: "object",
              required: ["id", "name"],
              properties: {
                id: { type: "integer", example: 3 },
                name: { type: "string", example: "Elis Regina" },
              },
            },
          },
        },
      },
      ArtistHit: {
        type: "object",
        required: ["id", "name", "musicCount"],
        properties: {
          id: { type: "integer", example: 3 },
          name: { type: "string", example: "Elis Regina" },
          musicCount: { type: "integer", description: "Músicas ativas do artista.", example: 7 },
        },
      },
      PlaylistHit: {
        type: "object",
        required: ["id", "name", "isPrivate", "color", "musicCount"],
        properties: {
          id: { type: "integer", example: 42 },
          name: { type: "string", example: "Água fresca" },
          isPrivate: { type: "boolean", example: false },
          color: { type: ["string", "null"], example: "#1DB954" },
          musicCount: { type: "integer", description: "Músicas ativas da playlist.", example: 10 },
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
