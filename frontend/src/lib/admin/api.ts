// Calls to the API's admin panel (/api/admin) and catalog (/api/musics, /api/artists,
// /api/genres). The session cookie goes along (credentials: "include"); the API is what
// checks the admin role, so a non-admin only ever gets 403 back from here.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"

export type Role = "admin" | "assinante"

export interface AdminUser {
  id: number
  name: string
  email: string | null
  role: Role
  birthdate: string | null
  createdAt: string
  deletedAt: string | null
  plays: number
  lastPlayAt: string | null
}

export interface RecentPlay {
  musicId: number
  musicName: string
  artists: string[]
  event: "music_play" | "music_skip"
  at: string
  musicDeleted: boolean
}

export interface CatalogMusic {
  id: number
  name: string
  duration: number
  streams: number
  plays: number
  artists: { id: number; name: string }[]
  genres: { id: number; name: string; color: string }[]
  createdAt: string
  deletedAt: string | null
}

export interface NamedItem {
  id: number
  name: string
}

export interface Genre extends NamedItem {
  color: string
}

export interface UsageStats {
  users: { active: number; admins: number; deleted: number; newLast30Days: number }
  catalog: { musics: number; deletedMusics: number; artists: number; playlists: number }
  plays: { total: number; last30Days: number }
  byContent: { musicId: number; name: string; artists: string[]; plays: number; streams: number; deleted: boolean }[]
  byGenre: { genreId: number; name: string; color: string; plays: number }[]
}

export interface NewUser {
  name: string
  email: string
  password: string
  birthdate: string
  role: Role
}

export interface MusicInput {
  name: string
  duration: number
  artistIds: number[]
  genreIds: number[]
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

// Messages for the codes the panel can trigger; anything else falls back to a generic one
const MESSAGES: Record<string, string> = {
  "Email already in use": "Já existe uma conta com esse email.",
  "Admins cannot remove their own account": "Você não pode remover a sua própria conta.",
  "The last platform admin cannot be removed": "Não dá para remover o último admin da plataforma.",
  "Music must have at least one artist": "A música precisa de pelo menos um artista.",
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    const headers = new Headers(init.headers)
    if (init.body) headers.set("Content-Type", "application/json")
    res = await fetch(`${API_URL}/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new ApiError(0, "Não foi possível falar com a API. Verifique a conexão.")
  }
  // The API's JSON shape is the contract typed above; 204 is for the void calls
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (res.status === 204) return undefined as T
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, body))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    if ("message" in body && typeof body.message === "string" && MESSAGES[body.message]) {
      return MESSAGES[body.message]
    }
    if ("fields" in body && Array.isArray(body.fields)) return "Confira os campos: algum valor é inválido."
  }
  if (status === 401) return "Sua sessão expirou. Entre de novo."
  if (status === 403) return "Só admins da plataforma podem fazer isso."
  if (status === 404) return "Registro não encontrado (pode já ter sido removido)."
  return "Algo deu errado. Tente de novo."
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const query = (q?: string) => (q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "")

export const adminApi = {
  stats: () => request<UsageStats>("/admin/stats"),

  listUsers: (q?: string) => request<AdminUser[]>(`/admin/users${query(q)}`),
  createUser: (input: NewUser) => request<AdminUser>("/admin/users", json("POST", input)),
  removeUser: (id: number) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
  recentPlays: (id: number) => request<RecentPlay[]>(`/admin/users/${id}/plays`),

  // For an admin this also returns removed musics, with deletedAt set
  listMusics: (q?: string) => request<CatalogMusic[]>(`/musics${query(q)}`),
  listArtists: () => request<NamedItem[]>("/artists"),
  listGenres: () => request<Genre[]>("/genres"),
  createMusic: (input: MusicInput) => request<unknown>("/admin/musics", json("POST", input)),
  updateMusic: (id: number, input: Partial<MusicInput>) => request<unknown>(`/admin/musics/${id}`, json("PATCH", input)),
  removeMusic: (id: number) => request<void>(`/admin/musics/${id}`, { method: "DELETE" }),
  createArtist: (name: string) => request<NamedItem>("/admin/artists", json("POST", { name })),
  renameArtist: (id: number, name: string) => request<NamedItem>(`/admin/artists/${id}`, json("PATCH", { name })),
  removeArtist: (id: number) => request<void>(`/admin/artists/${id}`, { method: "DELETE" }),
}

/** 258 → "4:18". */
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** "4:18" or "258" → 258; null when it is neither. */
export function parseDuration(value: string): number | null {
  const text = value.trim()
  const match = /^(\d+):([0-5]\d)$/.exec(text)
  const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : /^\d+$/.test(text) ? Number(text) : NaN
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}
