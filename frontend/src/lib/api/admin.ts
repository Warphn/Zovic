import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { catalogApi, catalogKeys, type NamedItem } from "./catalog"
import { json, queryString, request } from "./client"
import { searchKeys } from "./search"

// /api/admin: the platform admins' panel. The API checks the role; for anyone else every call
// answers 403 (api/adapters/http/routes.ts).

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
  /** Null leaves (or takes) the music out of any album. */
  albumId: number | null
  isExplicit: boolean
}

/** A new music also carries its MP3; editing doesn't change the audio. */
export type NewMusicInput = MusicInput & { audio: File }

export interface AlbumInput {
  name: string
  artistIds: number[]
  year: number
}

/** The API's limit (api/domain/shared/audio.ts), repeated here only to warn before uploading. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024

/** POST /api/admin/musics is multipart: the fields as JSON in "data" and the MP3 in "audio". */
export function musicFormData({ audio, ...fields }: NewMusicInput): FormData {
  const form = new FormData()
  form.append("data", JSON.stringify(fields))
  form.append("audio", audio)
  return form
}

const q = (search?: string) => queryString({ q: search?.trim() || undefined })

export const adminApi = {
  stats: (signal?: AbortSignal) => request<UsageStats>("/admin/stats", { signal }),

  listUsers: (search?: string, signal?: AbortSignal) => request<AdminUser[]>(`/admin/users${q(search)}`, { signal }),
  createUser: (input: NewUser) => request<AdminUser>("/admin/users", json("POST", input)),
  removeUser: (id: number) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
  recentPlays: (id: number, signal?: AbortSignal) => request<RecentPlay[]>(`/admin/users/${id}/plays`, { signal }),

  createMusic: (input: NewMusicInput) => request<unknown>("/admin/musics", { method: "POST", body: musicFormData(input) }),
  updateMusic: (id: number, input: Partial<MusicInput>) => request<unknown>(`/admin/musics/${id}`, json("PATCH", input)),
  removeMusic: (id: number) => request<void>(`/admin/musics/${id}`, { method: "DELETE" }),
  createAlbum: (input: AlbumInput) => request<unknown>("/admin/albums", json("POST", input)),
  updateAlbum: (id: number, input: Partial<AlbumInput>) => request<unknown>(`/admin/albums/${id}`, json("PATCH", input)),
  removeAlbum: (id: number) => request<void>(`/admin/albums/${id}`, { method: "DELETE" }),
  createArtist: (name: string) => request<NamedItem>("/admin/artists", json("POST", { name })),
  renameArtist: (id: number, name: string) => request<NamedItem>(`/admin/artists/${id}`, json("PATCH", { name })),
  removeArtist: (id: number) => request<void>(`/admin/artists/${id}`, { method: "DELETE" }),
}

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  users: (search = "") => [...adminKeys.all, "users", search.trim()] as const,
  recentPlays: (userId: number) => [...adminKeys.all, "plays", userId] as const,
  // The panel's music list keeps its own key: unlike the catalog cache it refreshes after plays
  musics: (search = "") => [...adminKeys.all, "musics", search.trim()] as const,
}

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats(), queryFn: ({ signal }) => adminApi.stats(signal) })
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: adminKeys.users(search),
    queryFn: ({ signal }) => adminApi.listUsers(search, signal),
    placeholderData: keepPreviousData,
  })
}

/** The user's last plays; idle while `userId` is null. */
export function useRecentPlays(userId: number | null) {
  return useQuery({
    queryKey: adminKeys.recentPlays(userId ?? 0),
    queryFn: ({ signal }) => adminApi.recentPlays(userId ?? 0, signal),
    enabled: userId !== null,
  })
}

/** Every music, removed ones included (the viewer is an admin). */
export function useAdminMusics(search: string) {
  return useQuery({
    queryKey: adminKeys.musics(search),
    queryFn: ({ signal }) => catalogApi.musics(search, signal),
    placeholderData: keepPreviousData,
  })
}

// What each kind of change makes stale. Accounts only touch the panel; the catalog also shows
// up in the search, in the player's suggestions and in the stats.
function useInvalidate(scope: "users" | "catalog") {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.all }),
      ...(scope === "catalog"
        ? [
            queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
            queryClient.invalidateQueries({ queryKey: searchKeys.all }),
          ]
        : []),
    ])
}

export function useCreateUser() {
  const invalidate = useInvalidate("users")
  return useMutation({ mutationFn: adminApi.createUser, onSuccess: invalidate })
}

export function useRemoveUser() {
  const invalidate = useInvalidate("users")
  return useMutation({ mutationFn: adminApi.removeUser, onSuccess: invalidate })
}

/** Creates the music (with its MP3) or updates an existing one, which keeps its audio. */
export function useSaveMusic() {
  const invalidate = useInvalidate("catalog")
  return useMutation({
    mutationFn: (save: { id: null; input: NewMusicInput } | { id: number; input: MusicInput }) =>
      save.id === null ? adminApi.createMusic(save.input) : adminApi.updateMusic(save.id, save.input),
    onSuccess: invalidate,
  })
}

export function useRemoveMusic() {
  const invalidate = useInvalidate("catalog")
  return useMutation({ mutationFn: adminApi.removeMusic, onSuccess: invalidate })
}

export function useCreateAlbum() {
  const invalidate = useInvalidate("catalog")
  return useMutation({ mutationFn: adminApi.createAlbum, onSuccess: invalidate })
}

export function useUpdateAlbum() {
  const invalidate = useInvalidate("catalog")
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<AlbumInput> }) => adminApi.updateAlbum(id, input),
    onSuccess: invalidate,
  })
}

export function useRemoveAlbum() {
  const invalidate = useInvalidate("catalog")
  return useMutation({ mutationFn: adminApi.removeAlbum, onSuccess: invalidate })
}

export function useCreateArtist() {
  const invalidate = useInvalidate("catalog")
  return useMutation({ mutationFn: adminApi.createArtist, onSuccess: invalidate })
}

export function useRenameArtist() {
  const invalidate = useInvalidate("catalog")
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => adminApi.renameArtist(id, name),
    onSuccess: invalidate,
  })
}

export function useRemoveArtist() {
  const invalidate = useInvalidate("catalog")
  return useMutation({ mutationFn: adminApi.removeArtist, onSuccess: invalidate })
}
