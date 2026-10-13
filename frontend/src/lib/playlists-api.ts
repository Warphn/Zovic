export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"
export const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? "1"
export const PLAYLIST_NAME_MAX_LENGTH = 150

export interface CreatePlaylistBody {
  name: string
  color?: string | null
  isPrivate?: boolean
}

export interface CreatedPlaylist {
  id: number
  name: string
  color: string | null
  isPrivate: boolean
  createdAt: string
}

export type PlaylistField = "name" | "color" | "isPrivate"

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

const FIELD_MESSAGES: Record<PlaylistField, string> = {
  name: `O nome é obrigatório e pode ter até ${PLAYLIST_NAME_MAX_LENGTH} caracteres.`,
  color: "A cor precisa estar no formato #RRGGBB.",
  isPrivate: "Valor de privacidade inválido.",
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Não foi possível identificar o usuário. Verifique NEXT_PUBLIC_DEV_USER_ID.",
  404: "O usuário configurado não existe no banco. Rode o seed da API ou ajuste NEXT_PUBLIC_DEV_USER_ID.",
}

export class PlaylistApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Partial<Record<PlaylistField, string>> = {},
  ) {
    super(message)
    this.name = "PlaylistApiError"
  }
}

interface ValidationErrorBody {
  error: "VALIDATION_ERROR"
  fields: { field: string; message: string }[]
}

function isValidationErrorBody(body: unknown): body is ValidationErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "fields" in body &&
    Array.isArray(body.fields)
  )
}

function isPlaylistField(field: string): field is PlaylistField {
  return field in FIELD_MESSAGES
}

function isCreatedPlaylist(body: unknown): body is CreatedPlaylist {
  return (
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    typeof body.id === "number" &&
    "name" in body &&
    typeof body.name === "string" &&
    "isPrivate" in body &&
    typeof body.isPrivate === "boolean" &&
    "color" in body &&
    (typeof body.color === "string" || body.color === null) &&
    "createdAt" in body &&
    typeof body.createdAt === "string"
  )
}

export async function createPlaylist(
  body: CreatePlaylistBody,
  fetchImpl: FetchLike = fetch,
): Promise<CreatedPlaylist> {
  let response: Response
  try {
    response = await fetchImpl(`${API_URL}/api/playlists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": DEV_USER_ID,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new PlaylistApiError("Não foi possível conectar à API. Ela está rodando?")
  }

  const payload: unknown = await response.json().catch(() => null)

  if (response.ok) {
    if (isCreatedPlaylist(payload)) return payload
    throw new PlaylistApiError("A API respondeu num formato inesperado.")
  }

  if (response.status === 400 && isValidationErrorBody(payload)) {
    const fieldErrors: Partial<Record<PlaylistField, string>> = {}
    for (const { field } of payload.fields) {
      if (isPlaylistField(field)) fieldErrors[field] = FIELD_MESSAGES[field]
    }
    throw new PlaylistApiError("Revise os campos destacados.", fieldErrors)
  }

  throw new PlaylistApiError(
    STATUS_MESSAGES[response.status] ?? "Não foi possível criar a playlist. Tente de novo.",
  )
}
