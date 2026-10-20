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

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Zovic API",
    version: "0.1.0",
    description:
      "API do Zovic, streaming de músicas. A autenticação ainda é provisória: o usuário é identificado pelo header `x-user-id`.",
  },
  servers: [{ url: "/", description: "Esta API" }],
  tags: [
    { name: "Playlists", description: "Criação e gestão de playlists" },
    { name: "Comentários", description: "Comentários e denúncias em músicas" },
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
    "/api/playlists": {
      post: {
        tags: ["Playlists"],
        summary: "Cria uma playlist",
        description:
          "Cria a playlist e adiciona o usuário autenticado como primeiro membro, com papel de admin. Nomes repetidos são permitidos. Campos fora do schema são ignorados.",
        operationId: "createPlaylist",
        security: [{ UserIdHeader: [] }],
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
              },
            },
          },
          "401": {
            description: "Header x-user-id ausente ou inválido",
            content: {
              "application/json": {
                schema: errorResponse("UNAUTHENTICATED", "Missing or invalid x-user-id header"),
              },
            },
          },
          "404": {
            description: "O usuário do header x-user-id não existe",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "User not found") },
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
    "/api/musics/{musicId}/comments": {
      get: {
        tags: ["Comentários"],
        summary: "Lista os comentários ativos de uma música",
        description:
          "Usuários adultos visualizam todos os comentários ativos. Menores de idade ou usuários sem data de nascimento recebem lista vazia.",
        operationId: "listComments",
        security: [{ UserIdHeader: [] }],
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
          "401": {
            description: "Header x-user-id ausente ou inválido",
            content: {
              "application/json": {
                schema: errorResponse("UNAUTHENTICATED", "Missing or invalid x-user-id header"),
              },
            },
          },
          "404": {
            description: "Usuário autenticado não encontrado",
            content: {
              "application/json": { schema: errorResponse("NOT_FOUND", "User not found") },
            },
          },
        },
      },
      post: {
        tags: ["Comentários"],
        summary: "Cria um comentário para uma música",
        description:
          "Permite sincronizar com um segundo específico da faixa ou comentar de forma geral. Menores de idade são impedidos de comentar.",
        operationId: "createComment",
        security: [{ UserIdHeader: [] }],
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
          "401": {
            description: "Não autenticado",
            content: {
              "application/json": { schema: errorResponse("UNAUTHENTICATED", "Missing header") },
            },
          },
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
        },
      },
    },
    "/api/comments/{commentId}": {
      delete: {
        tags: ["Comentários"],
        summary: "Apaga o próprio comentário (soft delete)",
        description: "Apenas o autor pode apagar seu comentário.",
        operationId: "deleteComment",
        security: [{ UserIdHeader: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "204": { description: "Comentário apagado com sucesso" },
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
        },
      },
    },
    "/api/comments/{commentId}/reports": {
      post: {
        tags: ["Comentários"],
        summary: "Denuncia um comentário",
        description: "Usuários adultos podem denunciar comentários de terceiros.",
        operationId: "reportComment",
        security: [{ UserIdHeader: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
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
          "403": { description: "Menores de idade não podem denunciar" },
          "404": { description: "Comentário ou usuário não encontrado" },
          "409": { description: "Auto-denúncia ou denúncia duplicada" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      UserIdHeader: {
        type: "apiKey",
        in: "header",
        name: "x-user-id",
        description: "Provisório: id inteiro positivo de um usuário existente. Será trocado por autenticação real.",
      },
    },
    schemas: {
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
      Error: errorResponse("VALIDATION_ERROR", "Validation failed"),
    },
  },
};
