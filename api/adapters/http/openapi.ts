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
