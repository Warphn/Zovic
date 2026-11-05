import { Comment } from "../../domain/entities/comment.ts";
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
      "**Autenticação.** É feita pelo [Better Auth](https://www.better-auth.com), por sessão em cookie: `POST /api/auth/sign-in/email` (ou `/api/auth/sign-up/email`) define o cookie `zovic.session_token` (httpOnly), que o navegador envia nas próximas requisições. Fora `/api/auth/*`, `/health` e `GET /api/invitations/{token}`, toda rota exige a sessão e responde 401 sem ela.\n\n" +
      "**Testando por esta página.** Rode o `sign-in` em *Try it out*: o navegador guarda o cookie e as próximas chamadas daqui já vão autenticadas. O botão *Authorize* não é necessário (e não funciona com cookie: o navegador não deixa a página definir o cookie). Para isso a API precisa de `COOKIE_SECURE=false` quando roda em `http://`, e esta página deve ser aberta pelo mesmo endereço de `BETTER_AUTH_URL` (padrão `http://localhost:3333`). Com o seed LOCAL, todo usuário entra com `nome.sobrenome@zovic.test` e a senha `zovic123`.\n\n" +
      "**Erros.** As rotas `/api/auth/*` respondem `{ code, message }`; as demais, `{ error, message }`, ou `{ error: \"VALIDATION_ERROR\", fields }` quando a validação aponta campos.",
  },
  servers: [{ url: "/", description: "Esta API" }],
  tags: [
    { name: "Autenticação", description: "Cadastro, login, logout e sessão (Better Auth)" },
    { name: "Playlists", description: "Criação e gestão de playlists" },
    { name: "Comentários", description: "Comentários e denúncias em músicas" },
    { name: "Planos", description: "Assinatura (individual ou família): assinar, consultar e cancelar; no família, convidar, remover e sair" },
    { name: "Histórico", description: "Músicas que o usuário ouviu" },
    { name: "Busca", description: "Busca de músicas, artistas e playlists" },
    { name: "Catálogo", description: "Listas de músicas e álbuns" },
    { name: "Admin", description: "Painel dos admins da plataforma: cadastro de músicas (com o áudio) e de álbuns" },
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
          "Cadastra o usuário e responde com ele já logado: o cookie de sessão vem no `Set-Cookie`. O email é guardado em minúsculas e deve ser único. Menor de idade só se cadastra com o `invitationToken` de um convite do plano familiar, enviado para o mesmo email: a conta já nasce como membro do plano. Com o token válido, maior de idade também entra no plano. Limite: 10 cadastros por hora por IP.",
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
              "Corpo inválido: campo ausente (inclusive `birthdate`), email inválido, senha fora de 8 a 128 caracteres, nome fora de 1 a 150, data de nascimento inválida ou no futuro, JSON malformado, ou `invitationToken` que não é de um convite válido (inexistente, expirado, usado, cancelado, de plano cancelado ou enviado para outro email), com o código `INVALID_INVITATION`",
            content: {
              "application/json": {
                schema: authErrorResponse("VALIDATION_ERROR", "[body.email] Invalid email address"),
              },
            },
          },
          "403": {
            description: "Menor de idade sem `invitationToken`. A conta não é criada",
            content: {
              "application/json": {
                schema: authErrorResponse("MINOR_NEEDS_INVITATION", "Minors can only sign up with a family plan invitation"),
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
              example: { email: "ana@exemplo.com", password: "uma-senha-longa" },
            },
          },
        },
        responses: {
          "200": {
            description: "Sessão aberta",
            headers: { "Set-Cookie": { $ref: "#/components/headers/SessionCookie" } },
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "400": {
            description: "Corpo inválido ou JSON malformado",
            content: {
              "application/json": {
                schema: authErrorResponse("VALIDATION_ERROR", "[body.password] Expected string, received undefined"),
              },
            },
          },
          "401": {
            description: "Email ou senha incorretos",
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
          "Apaga a sessão no banco e limpa o cookie no navegador (Max-Age=0). Funciona mesmo sem sessão ativa (idempotente).",
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
                  anyOf: [{ $ref: "#/components/schemas/SessionResponse" }, { type: "null" }],
                },
              },
            },
          },
        },
      },
    },
    "/api/history": {
      get: {
        tags: ["Histórico"],
        summary: "Lista o histórico de reprodução",
        description:
          "As músicas que o usuário autenticado ouviu, cada uma uma vez, com a data da última reprodução, da mais recente para a mais antiga. Cada conta tem o próprio histórico, mesmo dentro do plano família. Música removida pelo admin continua na lista, com `isAvailable` falso. A reprodução é registrada por `POST /api/musics/{id}/plays`.",
        operationId: "listMyHistory",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Histórico do usuário (lista vazia se ele nunca ouviu nada)",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/HistoryEntry" } },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "500": { $ref: "#/components/responses/InternalError" },
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
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Playlists"],
        summary: "Cria uma playlist",
        description:
          "Cria a playlist e torna o usuário autenticado o primeiro membro dela, com papel de admin. Playlists nascem públicas se `isPrivate` não for enviado.",
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
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
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
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
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
    "/api/musics/{musicId}/comments": {
      get: {
        tags: ["Comentários"],
        summary: "Lista os comentários ativos de uma música",
        description:
          "Usuários adultos visualizam todos os comentários ativos. Menores de idade ou usuários sem data de nascimento recebem lista vazia.",
        operationId: "listComments",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "musicId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID da música",
          },
        ],
        responses: {
          "200": {
            description: "Lista de comentários da música",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CommentItem" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "404": {
            description: "Usuário autenticado não encontrado",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "User not found") },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Comentários"],
        summary: "Cria um comentário para uma música",
        description:
          "Permite sincronizar com um segundo específico da faixa ou comentar de forma geral. Menores de idade são impedidos de comentar.",
        operationId: "createComment",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "musicId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID da música",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCommentRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Comentário criado",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CommentCreated" } },
            },
          },
          "400": {
            description: "Validação inválida do comentário",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "Usuário menor de idade não pode comentar",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "Underage users cannot comment") },
            },
          },
          "404": {
            description: "Usuário não encontrado",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "User not found") },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/comments/{commentId}": {
      delete: {
        tags: ["Comentários"],
        summary: "Apaga um comentário próprio (soft delete)",
        description:
          "Apenas o autor do comentário pode apagá-lo. Comentários apagados não são listados.",
        operationId: "deleteComment",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID do comentário",
          },
        ],
        responses: {
          "204": { description: "Comentário apagado com sucesso" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "Tentativa de apagar comentário de outro usuário",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "You can only delete your own comments") },
            },
          },
          "404": {
            description: "Comentário não encontrado",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "Comment not found") },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/comments/{commentId}/reports": {
      post: {
        tags: ["Comentários"],
        summary: "Denuncia um comentário",
        description:
          "Usuários podem denunciar comentários de terceiros com justificativa de até 280 caracteres. Não é permitido auto-denúncia nem denúncias duplicadas.",
        operationId: "reportComment",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID do comentário",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReportCommentRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Denúncia registrada" },
          "400": { description: "Motivo inválido" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { description: "Menores de idade não podem denunciar" },
          "404": { description: "Comentário ou usuário não encontrado" },
          "409": { description: "Auto-denúncia ou denúncia duplicada" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/playlists/{id}/musics": {
      parameters: [{ $ref: "#/components/parameters/PlaylistId" }],
      get: {
        tags: ["Playlists"],
        summary: "Lista as músicas de uma playlist",
        description:
          "As músicas ativas da playlist, na ordem dela (a mesma para todos que a veem). Quem vê a playlist vê as músicas: a privada de outra pessoa responde 404. Músicas apagadas ficam de fora, e artistas apagados saem da lista de artistas.",
        operationId: "listPlaylistMusics",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Músicas da playlist, por posição (lista vazia se não houver nenhuma)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlaylistMusicList" } } },
          },
          "400": { $ref: "#/components/responses/InvalidPlaylistId" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "404": { $ref: "#/components/responses/PlaylistNotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Playlists"],
        summary: "Põe uma música na playlist",
        description:
          "Só admins da playlist. A música entra no fim. A mesma música não entra duas vezes. Responde com a lista inteira, já com a música nova.",
        operationId: "addPlaylistMusic",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddPlaylistMusicRequest" },
              example: { musicId: 12 },
            },
          },
        },
        responses: {
          "201": {
            description: "Música incluída; a lista inteira, por posição",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlaylistMusicList" } } },
          },
          "400": {
            description: "Id da playlist ou `musicId` inválido, ou JSON malformado",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlaylistAdmin" },
          "404": {
            description: "A playlist não existe ou não é visível para o usuário, ou a música não existe ou foi apagada",
            content: {
              "application/json": {
                schema: errorResponse("NOT_FOUND", "Music not found"),
              },
            },
          },
          "409": {
            description: "A música já está na playlist",
            content: {
              "application/json": {
                schema: errorResponse("BUSINESS_RULE_ERROR", "Music is already in this playlist"),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/playlists/{id}/musics/order": {
      parameters: [{ $ref: "#/components/parameters/PlaylistId" }],
      put: {
        tags: ["Playlists"],
        summary: "Reordena as músicas da playlist",
        description:
          "Só admins da playlist. `musicIds` é a sequência nova, com **todas** as músicas da playlist, cada uma uma vez (vazia na playlist vazia). Se faltar ou sobrar música, alguém mudou a playlist depois que ela foi carregada: responde 409 e nada muda, para o cliente recarregar a lista em vez de desfazer a mudança da outra pessoa. Responde com a lista na ordem nova.",
        operationId: "reorderPlaylistMusics",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReorderPlaylistMusicsRequest" },
              example: { musicIds: [31, 12, 7] },
            },
          },
        },
        responses: {
          "200": {
            description: "Ordem gravada; a lista inteira na ordem nova",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlaylistMusicList" } } },
          },
          "400": {
            description: "Id da playlist inválido, `musicIds` ausente, com id inválido ou repetido, ou JSON malformado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FieldValidationError" },
                example: { error: "VALIDATION_ERROR", fields: [{ field: "musicIds.1", message: '"musicIds[1]" contains a duplicate value' }] },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlaylistAdmin" },
          "404": { $ref: "#/components/responses/PlaylistNotFound" },
          "409": {
            description: "A lista não tem exatamente as músicas da playlist: recarregue e tente de novo",
            content: {
              "application/json": {
                schema: errorResponse(
                  "BUSINESS_RULE_ERROR",
                  "The new order must have exactly the playlist's musics; reload it and try again",
                ),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/playlists/{id}/musics/{musicId}": {
      parameters: [{ $ref: "#/components/parameters/PlaylistId" }, { $ref: "#/components/parameters/MusicId" }],
      delete: {
        tags: ["Playlists"],
        summary: "Tira uma música da playlist",
        description: "Só admins da playlist. As outras músicas mantêm a ordem.",
        operationId: "removePlaylistMusic",
        security: [{ cookieAuth: [] }],
        responses: {
          "204": { description: "Música tirada da playlist" },
          "400": {
            description: "Id da playlist ou da música não é um inteiro positivo",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlaylistAdmin" },
          "404": {
            description: "A playlist não existe ou não é visível para o usuário, ou a música não está nela",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "Music is not in this playlist") },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans": {
      post: {
        tags: ["Planos"],
        summary: "Assina o plano individual ou o família",
        description:
          "Pagamento simulado: a assinatura fica ativa na hora. Só maiores de idade assinam (pela data de nascimento da conta) e cada conta tem no máximo uma assinatura ativa, contando a de membro de um plano familiar. O corpo é opcional: sem ele, o plano é o individual. No família, quem assina vira o gestor, com até 4 pessoas.",
        operationId: "subscribePlan",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SubscribeRequest" },
              example: { kind: "family" },
            },
          },
        },
        responses: {
          "400": { $ref: "#/components/responses/PlanValidationError" },
          "201": {
            description: "Assinatura criada",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Subscription" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é de menor de idade (ou não tem data de nascimento). Nada é criado",
            content: { "application/json": { schema: errorResponse("FORBIDDEN", "Only adults can subscribe") } },
          },
          "409": {
            description: "A conta já tem uma assinatura ativa",
            content: {
              "application/json": {
                schema: errorResponse("BUSINESS_RULE_ERROR", "Account already has an active subscription"),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me": {
      get: {
        tags: ["Planos"],
        summary: "Assinatura ativa da conta",
        description: "Vale também para quem é membro de um plano familiar. Sem assinatura ativa, responde 200 com `null`.",
        operationId: "getMySubscription",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "A assinatura ativa, ou `null`",
            content: {
              "application/json": {
                schema: { oneOf: [{ $ref: "#/components/schemas/Subscription" }, { type: "null" }] },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Planos"],
        summary: "Cancela a assinatura",
        description:
          "Cancelamento imediato. Só o assinante do individual ou o gestor do familiar cancela; no familiar, o acesso de todos os membros acaba, mas as contas e os dados continuam. Depois a pessoa pode assinar de novo.",
        operationId: "cancelSubscription",
        security: [{ cookieAuth: [] }],
        responses: {
          "204": { description: "Assinatura cancelada" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é membro de um plano familiar, mas não o gestor",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "Only the plan manager can cancel it") },
            },
          },
          "404": {
            description: "A conta não tem assinatura ativa",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "No active subscription") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me/members": {
      get: {
        tags: ["Planos"],
        summary: "Membros, convites pendentes e vagas do plano familiar",
        description:
          "Só o gestor. O limite é de 4 pessoas, contando o gestor; convite pendente (não usado, não cancelado e não expirado) ocupa vaga. Contas removidas pela plataforma não aparecem nem ocupam vaga. O token dos convites nunca aparece aqui.",
        operationId: "listPlanMembers",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "O plano",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlanMembers" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é membro, mas não o gestor",
            content: { "application/json": { schema: errorResponse("FORBIDDEN", "Only the plan manager can list members") } },
          },
          "404": {
            description: "A conta não tem assinatura ativa",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "No active subscription") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me/invitations": {
      post: {
        tags: ["Planos"],
        summary: "Convida alguém para o plano familiar",
        description:
          "Só o gestor. O convite vale 7 dias, é de uso único e ocupa uma vaga até ser aceito, cancelado ou expirar. O `token` do link aparece só nesta resposta: o banco guarda apenas o hash. Se o link se perder, cancele o convite e crie outro. O email é comparado sem diferenciar maiúsculas.",
        operationId: "inviteToPlan",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InviteRequest" },
              example: { email: "filho@exemplo.com" },
            },
          },
        },
        responses: {
          "201": {
            description: "Convite criado",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreatedInvitation" } } },
          },
          "400": { $ref: "#/components/responses/PlanValidationError" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é membro, mas não o gestor",
            content: { "application/json": { schema: errorResponse("FORBIDDEN", "Only the plan manager can invite") } },
          },
          "404": {
            description: "A conta não tem assinatura ativa",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "No active subscription") } },
          },
          "409": {
            description:
              "O plano é individual, não tem vaga livre, o email já é de um membro ou já tem convite pendente",
            content: {
              "application/json": {
                examples: {
                  semVaga: { value: { error: "BUSINESS_RULE_ERROR", message: "The plan has no free slots" } },
                  individual: {
                    value: { error: "BUSINESS_RULE_ERROR", message: "Only family plans accept invitations" },
                  },
                  membro: {
                    value: { error: "BUSINESS_RULE_ERROR", message: "This email is already a member of the plan" },
                  },
                  pendente: {
                    value: { error: "BUSINESS_RULE_ERROR", message: "This email already has a pending invitation" },
                  },
                },
                schema: errorResponse("BUSINESS_RULE_ERROR", "The plan has no free slots"),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me/invitations/{id}": {
      delete: {
        tags: ["Planos"],
        summary: "Cancela um convite pendente",
        description: "Só o gestor. O link deixa de valer e a vaga volta.",
        operationId: "cancelPlanInvitation",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "204": { description: "Convite cancelado" },
          "400": { $ref: "#/components/responses/PlanValidationError" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é membro, mas não o gestor",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "Only the plan manager can cancel invitations") },
            },
          },
          "404": {
            description: "A conta não tem assinatura ativa, ou o convite não existe neste plano ou já não está pendente",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Invitation not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me/members/{userId}": {
      delete: {
        tags: ["Planos"],
        summary: "Remove um membro do plano familiar",
        description:
          "Só o gestor. O vínculo some: o membro perde o acesso na próxima requisição e a vaga volta. As playlists e o histórico dele continuam, e ele pode assinar de novo.",
        operationId: "removePlanMember",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "204": { description: "Membro removido" },
          "400": { $ref: "#/components/responses/PlanValidationError" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "A conta é membro, mas não o gestor",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "Only the plan manager can remove members") },
            },
          },
          "404": {
            description: "A conta não tem assinatura ativa, ou o usuário não é membro deste plano",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Member not found") } },
          },
          "409": {
            description: "O gestor tentou se remover: ele cancela o plano",
            content: {
              "application/json": {
                schema: errorResponse("BUSINESS_RULE_ERROR", "The manager cannot be removed: cancel the plan instead"),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/plans/me/membership": {
      delete: {
        tags: ["Planos"],
        summary: "Sai do plano familiar",
        description:
          "Para quem é membro, não gestor. O acesso acaba na hora; as playlists e o histórico continuam. O gestor cancela o plano em `DELETE /api/plans/me`.",
        operationId: "leavePlan",
        security: [{ cookieAuth: [] }],
        responses: {
          "204": { description: "A conta saiu do plano" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "404": {
            description: "A conta não tem assinatura ativa",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "No active subscription") } },
          },
          "409": {
            description: "A conta é a gestora do plano",
            content: {
              "application/json": {
                schema: errorResponse("BUSINESS_RULE_ERROR", "The manager cannot leave the plan: cancel it instead"),
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/invitations/{token}": {
      get: {
        tags: ["Planos"],
        summary: "Consulta um convite pelo link",
        description:
          "Pública, para a tela do convite funcionar antes de a pessoa ter conta. Convite usado, expirado, cancelado, de plano cancelado, inexistente ou com token malformado dá sempre o mesmo 404.",
        operationId: "getInvitation",
        security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "O convite pendente",
            content: { "application/json": { schema: { $ref: "#/components/schemas/InvitationInfo" } } },
          },
          "404": {
            description: "Convite inválido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Invitation not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/invitations/{token}/accept": {
      post: {
        tags: ["Planos"],
        summary: "Aceita um convite com a conta logada",
        description:
          "Só a conta com o email do convite aceita (sem diferenciar maiúsculas), e só quem não tem assinatura ativa. Menor de idade também aceita. O convite fica usado. Quem ainda não tem conta se cadastra pelo link em `POST /api/auth/sign-up/email`, com o `invitationToken`.",
        operationId: "acceptInvitation",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "A conta virou membro do plano",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Subscription" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": {
            description: "O convite foi enviado para outro email",
            content: {
              "application/json": { schema: errorResponse("FORBIDDEN", "This invitation was sent to another email") },
            },
          },
          "404": {
            description: "Convite inválido (usado, expirado, cancelado, de plano cancelado, inexistente ou malformado)",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Invitation not found") } },
          },
          "409": {
            description: "A conta já tem uma assinatura ativa. O convite continua valendo",
            content: {
              "application/json": {
                schema: errorResponse(
                  "BUSINESS_RULE_ERROR",
                  "Leave or cancel your current plan before accepting an invitation",
                ),
              },
            },
          },
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
            description: "Termo vazio ou acima de 100 caracteres, limite fora de 1 a 50, ou parâmetros desconhecidos",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/musics": {
      get: {
        tags: ["Catálogo"],
        summary: "Lista as músicas do catálogo",
        description:
          "Músicas ativas por nome. Para um admin da plataforma, vêm também as removidas, com `deletedAt` preenchido. `q` filtra pelo nome da música ou do artista.",
        operationId: "listMusics",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "q", in: "query", required: false, description: "Parte do nome da música ou do artista.", schema: { type: "string", example: "lago" } },
        ],
        responses: {
          "200": {
            description: "As músicas",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/MusicListItem" } } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/albums": {
      get: {
        tags: ["Catálogo"],
        summary: "Lista os álbuns do catálogo",
        description: "Álbuns ativos, por nome, com o ano e os artistas.",
        operationId: "listAlbums",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Os álbuns",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AlbumListItem" } } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/SubscriptionRequired" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/admin/musics": {
      post: {
        tags: ["Admin"],
        summary: "Cadastra uma música com o arquivo de áudio",
        description:
          "Recebe `multipart/form-data` com duas partes: `data`, um texto JSON com os campos da música, e `audio`, o arquivo MP3 de até 20 MB. O formato é conferido pelos primeiros bytes do arquivo, e não pela extensão. Sem áudio, a música não é criada. O arquivo é guardado no servidor com um nome novo, e a resposta traz só `hasAudio`.",
        operationId: "createMusic",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["data", "audio"],
                properties: {
                  data: {
                    type: "string",
                    description: "JSON no formato de `MusicInput`.",
                    example: '{"name":"Ressaca","duration":214,"artistIds":[1],"genreIds":[2],"albumId":3,"isExplicit":false}',
                  },
                  audio: { type: "string", format: "binary", description: "O arquivo MP3, de até 20 MB." },
                },
              },
              encoding: { data: { contentType: "application/json" }, audio: { contentType: "audio/mpeg" } },
            },
          },
        },
        responses: {
          "201": { description: "A música criada", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminMusic" } } } },
          "400": {
            description:
              "Campos inválidos (`VALIDATION_ERROR`), `data` que não é JSON (`INVALID_JSON`), arquivo numa parte que não é `audio`, mais de um arquivo ou multipart malformado (`INVALID_UPLOAD`), sem áudio ou com um arquivo que não é MP3",
            content: {
              "application/json": {
                schema: { oneOf: [{ $ref: "#/components/schemas/FieldValidationError" }, errorResponse("VALIDATION_ERROR", "Audio file must be an MP3")] },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlatformAdmin" },
          "404": {
            description: "Artista, gênero ou álbum inexistente ou removido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Album not found") } },
          },
          "413": {
            description: "O arquivo passa de 20 MB",
            content: { "application/json": { schema: errorResponse("AUDIO_TOO_LARGE", "Audio file must be at most 20 MB") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/admin/musics/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Edita uma música",
        description:
          "JSON com qualquer subconjunto dos campos. `artistIds` e `genreIds` substituem a lista inteira, e `albumId: null` tira a música do álbum. O arquivo de áudio não muda por aqui.",
        operationId: "updateMusic",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MusicUpdate" } } },
        },
        responses: {
          "200": { description: "A música editada", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminMusic" } } } },
          "400": { description: "Campos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } } },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlatformAdmin" },
          "404": {
            description: "Música, artista, gênero ou álbum inexistente ou removido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Music not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/admin/albums": {
      post: {
        tags: ["Admin"],
        summary: "Cadastra um álbum",
        description: "O ano vai de 1900 até o ano atual.",
        operationId: "createAlbum",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AlbumInput" } } },
        },
        responses: {
          "201": { description: "O álbum criado", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminAlbum" } } } },
          "400": {
            description: "Campos inválidos, ou ano depois do atual",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlatformAdmin" },
          "404": {
            description: "Artista inexistente ou removido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Artist 7 not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/admin/albums/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Edita um álbum",
        description: "JSON com qualquer subconjunto de `name`, `artistIds` e `year`. `artistIds` substitui a lista inteira.",
        operationId: "updateAlbum",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AlbumUpdate" } } },
        },
        responses: {
          "200": { description: "O álbum editado", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminAlbum" } } } },
          "400": { description: "Campos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } } },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlatformAdmin" },
          "404": {
            description: "Álbum ou artista inexistente ou removido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Album not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Remove um álbum",
        description: "Soft delete: o álbum some das listas, e as músicas dele continuam no catálogo.",
        operationId: "deleteAlbum",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "204": { description: "Removido" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/NotPlatformAdmin" },
          "404": {
            description: "Álbum inexistente ou já removido",
            content: { "application/json": { schema: errorResponse("NOT_FOUND", "Album not found") } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
  components: {
    parameters: {
      MusicId: {
        name: "musicId",
        in: "path",
        required: true,
        description: "Id da música: inteiro positivo, sem zero à esquerda.",
        schema: { type: "integer", minimum: 1, maximum: 2_147_483_647, example: 12 },
      },
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
      PlanValidationError: {
        description: "Corpo ou parâmetro inválido (`kind` desconhecido, email inválido, id que não é inteiro positivo)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/FieldValidationError" } } },
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
      NotPlatformAdmin: {
        description: "A conta não tem o papel de admin da plataforma",
        content: {
          "application/json": { schema: errorResponse("FORBIDDEN", "Platform admin role required") },
        },
      },
      SubscriptionRequired: {
        description: "A conta não tem assinatura ativa. Admins da plataforma passam sem assinatura",
        content: {
          "application/json": { schema: errorResponse("SUBSCRIPTION_REQUIRED", "Active subscription required") },
        },
      },
      NotPlaylistAdmin: {
        description:
          "O usuário vê a playlist, mas não é admin dela (só admins editam, apagam e mudam as músicas). Sem assinatura ativa, o erro é `SUBSCRIPTION_REQUIRED`",
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
      Subscription: {
        type: "object",
        required: ["planId", "kind", "isManager", "startedAt"],
        properties: {
          planId: { type: "integer", example: 7 },
          kind: { type: "string", enum: ["individual", "family"], example: "individual" },
          isManager: {
            type: "boolean",
            description: "Dono do individual ou gestor do familiar. Só ele cancela.",
            example: true,
          },
          startedAt: { type: "string", format: "date-time" },
        },
      },
      SubscribeRequest: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["individual", "family"], default: "individual" },
        },
      },
      InviteRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", maxLength: 254, example: "filho@exemplo.com" },
        },
      },
      CreatedInvitation: {
        type: "object",
        required: ["id", "email", "expiresAt", "token"],
        properties: {
          id: { type: "integer", example: 12 },
          email: { type: "string", description: "Em minúsculas.", example: "filho@exemplo.com" },
          expiresAt: { type: "string", format: "date-time" },
          token: {
            type: "string",
            description: "Vai no link do convite. Só esta resposta o devolve.",
            example: "K3o1g8m2uJ0w5kq9Zc4vYd7R1sHn6LxPa2TbEfWiQMA",
          },
        },
      },
      InvitationInfo: {
        type: "object",
        required: ["email", "managerName", "expiresAt"],
        properties: {
          email: { type: "string", example: "filho@exemplo.com" },
          managerName: { type: "string", example: "Ana Andrade" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      PlanMembers: {
        type: "object",
        required: ["members", "pendingInvitations", "limit", "freeSlots"],
        properties: {
          members: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "email", "isManager"],
              properties: {
                id: { type: "integer", example: 3 },
                name: { type: "string", example: "Ana Andrade" },
                email: { type: ["string", "null"], example: "ana@exemplo.com" },
                isManager: { type: "boolean" },
              },
            },
          },
          pendingInvitations: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "email", "expiresAt"],
              properties: {
                id: { type: "integer", example: 12 },
                email: { type: "string", example: "filho@exemplo.com" },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
          },
          limit: { type: "integer", example: 4, description: "Máximo de pessoas, contando o gestor." },
          freeSlots: { type: "integer", example: 2, description: "Limite menos membros e convites pendentes." },
        },
      },
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
          invitationToken: {
            type: "string",
            description:
              "Token do link de um convite do plano familiar, enviado para o mesmo email do cadastro. Obrigatório para menor de idade. A conta entra no plano ao ser criada e o campo não é guardado.",
            example: "K3o1g8m2uJ0w5kq9Zc4vYd7R1sHn6LxPa2TbEfWiQMA",
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
      HistoryEntry: {
        type: "object",
        required: ["musicId", "name", "duration", "artists", "lastPlayedAt", "isAvailable"],
        properties: {
          musicId: { type: "integer", example: 7 },
          name: { type: "string", example: "Águas de Março" },
          duration: { type: "integer", description: "Duração em segundos.", example: 214 },
          artists: {
            type: "array",
            description: "Artistas ativos da música, em ordem alfabética.",
            items: {
              type: "object",
              required: ["id", "name"],
              properties: { id: { type: "integer", example: 3 }, name: { type: "string", example: "Elis Regina" } },
            },
          },
          lastPlayedAt: { type: "string", format: "date-time", example: "2026-10-13T19:25:03.445Z" },
          isAvailable: {
            type: "boolean",
            description: "Falso se o admin removeu a música do catálogo depois de ela ser ouvida.",
            example: true,
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
      CreateCommentRequest: {
        type: "object",
        required: ["comment"],
        properties: {
          comment: {
            type: "string",
            minLength: 1,
            maxLength: Comment.MAX_LENGTH,
            example: "Esse riff de guitarra aos 45 segundos é sensacional!",
          },
          timestamp: {
            type: ["integer", "null"],
            minimum: 0,
            example: 45,
            description: "Posição em segundos na faixa (opcional).",
          },
        },
      },
      ReportCommentRequest: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 280,
            example: "Conteúdo ofensivo ou spam.",
          },
        },
      },
      CommentCreated: {
        type: "object",
        required: ["id", "musicId", "userId", "comment", "timestamp", "createdAt"],
        properties: {
          id: { type: "integer", example: 101 },
          musicId: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          comment: { type: "string", example: "Belo arranjo!" },
          timestamp: { type: ["integer", "null"], example: 45 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CommentItem: {
        type: "object",
        required: ["id", "musicId", "userId", "authorName", "comment", "timestamp", "createdAt", "isMine"],
        properties: {
          id: { type: "integer", example: 101 },
          musicId: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          authorName: { type: "string", example: "Ana Andrade" },
          comment: { type: "string", example: "Belo arranjo!" },
          timestamp: { type: ["integer", "null"], example: 45 },
          createdAt: { type: "string", format: "date-time" },
          isMine: { type: "boolean", example: false },
        },
      },
      PlaylistMusicList: {
        type: "array",
        items: { $ref: "#/components/schemas/PlaylistMusic" },
      },
      PlaylistMusic: {
        type: "object",
        required: ["id", "name", "duration", "artists", "album", "addedAt"],
        properties: {
          id: { type: "integer", example: 12 },
          name: { type: "string", example: "Ressaca" },
          duration: { type: "integer", description: "Duração em segundos.", example: 214 },
          artists: {
            type: "array",
            description: "Artistas ativos da música, em ordem alfabética.",
            items: {
              type: "object",
              required: ["id", "name"],
              properties: {
                id: { type: "integer", example: 1 },
                name: { type: "string", example: "Maré Alta" },
              },
            },
          },
          album: {
            description: "O álbum ativo de menor id que contém a música, ou null se ela não está em nenhum.",
            oneOf: [
              {
                type: "object",
                required: ["id", "name"],
                properties: {
                  id: { type: "integer", example: 3 },
                  name: { type: "string", example: "Ondas de Concreto" },
                },
              },
              { type: "null" },
            ],
          },
          addedAt: {
            type: "string",
            format: "date-time",
            description: "Quando a música entrou na playlist.",
            example: "2026-11-03T18:20:00.000Z",
          },
        },
      },
      AddPlaylistMusicRequest: {
        type: "object",
        required: ["musicId"],
        properties: { musicId: { type: "integer", minimum: 1, example: 12 } },
      },
      ReorderPlaylistMusicsRequest: {
        type: "object",
        required: ["musicIds"],
        properties: {
          musicIds: {
            type: "array",
            uniqueItems: true,
            maxItems: 10_000,
            description: "Todas as músicas da playlist, na ordem nova.",
            items: { type: "integer", minimum: 1 },
            example: [31, 12, 7],
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
      MusicListItem: {
        type: "object",
        required: ["id", "name", "duration", "streams", "plays", "artists", "genres", "album", "isExplicit", "hasAudio", "createdAt", "deletedAt"],
        properties: {
          id: { type: "integer", example: 12 },
          name: { type: "string", example: "Ressaca" },
          duration: { type: "integer", description: "Segundos.", example: 214 },
          streams: { type: "integer", example: 30 },
          plays: { type: "integer", description: "Reproduções registradas.", example: 28 },
          artists: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } } },
          genres: {
            type: "array",
            items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, color: { type: "string" } } },
          },
          album: {
            type: ["object", "null"],
            description: "O álbum ativo da música, ou null se ela não está em nenhum.",
            properties: { id: { type: "integer" }, name: { type: "string" }, year: { type: ["integer", "null"] } },
            example: { id: 3, name: "Ondas de Concreto", year: 2018 },
          },
          isExplicit: { type: "boolean", example: false },
          hasAudio: { type: "boolean", description: "Músicas anteriores ao upload não têm arquivo de áudio.", example: true },
          createdAt: { type: "string", format: "date-time" },
          deletedAt: { type: ["string", "null"], format: "date-time", description: "Só para admins, nas removidas." },
        },
      },
      AlbumListItem: {
        type: "object",
        required: ["id", "name", "year", "artists"],
        properties: {
          id: { type: "integer", example: 3 },
          name: { type: "string", example: "Ondas de Concreto" },
          year: { type: ["integer", "null"], description: "null só nos álbuns antigos.", example: 2018 },
          artists: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } } },
        },
      },
      MusicInput: {
        type: "object",
        required: ["name", "duration", "artistIds"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255, example: "Ressaca" },
          duration: { type: "integer", minimum: 1, description: "Segundos.", example: 214 },
          artistIds: { type: "array", minItems: 1, items: { type: "integer", minimum: 1 }, example: [1] },
          genreIds: { type: "array", items: { type: "integer", minimum: 1 }, default: [], example: [2] },
          albumId: { type: ["integer", "null"], minimum: 1, default: null, description: "Zero ou um álbum.", example: 3 },
          isExplicit: { type: "boolean", default: false, example: false },
        },
      },
      MusicUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          duration: { type: "integer", minimum: 1 },
          artistIds: { type: "array", minItems: 1, items: { type: "integer", minimum: 1 } },
          genreIds: { type: "array", items: { type: "integer", minimum: 1 } },
          albumId: { type: ["integer", "null"], minimum: 1, description: "null tira a música do álbum." },
          isExplicit: { type: "boolean" },
        },
        example: { albumId: null, isExplicit: true },
      },
      AdminMusic: {
        type: "object",
        required: ["id", "name", "duration", "artistIds", "genreIds", "albumId", "isExplicit", "hasAudio", "createdAt", "deletedAt"],
        properties: {
          id: { type: "integer", example: 64 },
          name: { type: "string", example: "Ressaca" },
          duration: { type: "integer", example: 214 },
          artistIds: { type: "array", items: { type: "integer" }, example: [1] },
          genreIds: { type: "array", items: { type: "integer" }, example: [2] },
          albumId: { type: ["integer", "null"], example: 3 },
          isExplicit: { type: "boolean", example: false },
          hasAudio: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          deletedAt: { type: ["string", "null"], format: "date-time", example: null },
        },
      },
      AlbumInput: {
        type: "object",
        required: ["name", "artistIds", "year"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255, example: "Ondas de Concreto" },
          artistIds: { type: "array", minItems: 1, items: { type: "integer", minimum: 1 }, example: [1] },
          year: { type: "integer", minimum: 1900, description: "Até o ano atual.", example: 2018 },
        },
      },
      AlbumUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          artistIds: { type: "array", minItems: 1, items: { type: "integer", minimum: 1 } },
          year: { type: "integer", minimum: 1900 },
        },
        example: { year: 2019 },
      },
      AdminAlbum: {
        type: "object",
        required: ["id", "name", "year", "artistIds", "createdAt", "deletedAt"],
        properties: {
          id: { type: "integer", example: 3 },
          name: { type: "string", example: "Ondas de Concreto" },
          year: { type: ["integer", "null"], example: 2018 },
          artistIds: { type: "array", items: { type: "integer" }, example: [1] },
          createdAt: { type: "string", format: "date-time" },
          deletedAt: { type: ["string", "null"], format: "date-time", example: null },
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
