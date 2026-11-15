import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { json, request } from "./client"
import { searchKeys } from "./search"

// /api/playlists: the viewer's playlists and the musics in each, in the playlist's order
// (api/adapters/http/playlist-controller.ts).

export interface Playlist {
  id: number
  name: string
  isPrivate: boolean
  color: string | null
  /** ISO date-time. */
  createdAt: string
  /** Whether the viewer is the owner: renames, deletes and manages the collaborators. */
  isAdmin: boolean
  /** Whether the viewer puts, takes out and reorders the musics: the owner and the collaborators (HU-19). */
  canEditMusics: boolean
}

/** Someone who builds the playlist, as GET /playlists/:id/collaborators lists them (no email). */
export interface Collaborator {
  userId: number
  name: string
  isOwner: boolean
}

/** A music in a playlist, as GET /playlists/:id/musics lists it (api/domain/ports/playlist-musics.ts). */
export interface PlaylistMusic {
  id: number
  name: string
  /** Seconds. */
  duration: number
  /** Active artists, alphabetical. */
  artists: { id: number; name: string }[]
  /** The lowest-id active album that has the music, or null when it is in none. */
  album: { id: number; name: string } | null
  /** When it entered the playlist (ISO). */
  addedAt: string
}

export interface PlaylistInput {
  name?: string
  isPrivate?: boolean
  /** #RRGGBB, or null to clear it. */
  color?: string | null
}

export const playlistsApi = {
  /** The playlists the viewer is a member of, newest first. */
  list: (signal?: AbortSignal) => request<Playlist[]>("/playlists", { signal }),
  /** Any public playlist, or a private one the viewer is a member of (404 otherwise). */
  get: (id: number, signal?: AbortSignal) => request<Playlist>(`/playlists/${id}`, { signal }),
  create: (input: PlaylistInput & { name: string }) => request<Playlist>("/playlists", json("POST", input)),
  update: (id: number, input: PlaylistInput) => request<Playlist>(`/playlists/${id}`, json("PATCH", input)),
  remove: (id: number) => request<void>(`/playlists/${id}`, { method: "DELETE" }),

  /** The playlist's active musics, in its order. Same visibility as `get`. */
  musics: (id: number, signal?: AbortSignal) => request<PlaylistMusic[]>(`/playlists/${id}/musics`, { signal }),
  /** Puts the music at the end (owner and collaborators); answers the updated list. */
  addMusic: (id: number, musicId: number) =>
    request<PlaylistMusic[]>(`/playlists/${id}/musics`, json("POST", { musicId })),
  /** Takes the music out (owner and collaborators). */
  removeMusic: (id: number, musicId: number) =>
    request<void>(`/playlists/${id}/musics/${musicId}`, { method: "DELETE" }),
  /** The new order, with every active music of the playlist exactly once; answers the updated list. */
  reorderMusics: (id: number, musicIds: number[]) =>
    request<PlaylistMusic[]>(`/playlists/${id}/musics/order`, json("PUT", { musicIds })),

  /** The owner first, then the collaborators by name. Same visibility as `get`. */
  collaborators: (id: number, signal?: AbortSignal) =>
    request<Collaborator[]>(`/playlists/${id}/collaborators`, { signal }),
  /** Owner only: adds the subscriber with this email; answers the updated list. */
  addCollaborator: (id: number, email: string) =>
    request<Collaborator[]>(`/playlists/${id}/collaborators`, json("POST", { email })),
  /** The owner removes a collaborator; a collaborator passes their own id to leave. */
  removeCollaborator: (id: number, userId: number) =>
    request<void>(`/playlists/${id}/collaborators/${userId}`, { method: "DELETE" }),
}

export const playlistKeys = {
  all: ["playlists"] as const,
  list: () => [...playlistKeys.all, "list"] as const,
  detail: (id: number) => [...playlistKeys.all, "detail", id] as const,
  musics: (id: number) => [...playlistKeys.all, "musics", id] as const,
  collaborators: (id: number) => [...playlistKeys.all, "collaborators", id] as const,
}

/** A route param as a playlist id; null when it is not a positive integer (an old local id, say). */
export function parsePlaylistId(param: string | null | undefined): number | null {
  if (!param || !/^\d+$/.test(param)) return null
  const id = Number(param)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function useMyPlaylists() {
  return useQuery({ queryKey: playlistKeys.list(), queryFn: ({ signal }) => playlistsApi.list(signal) })
}

/** One playlist; idle while `id` is null. */
export function usePlaylist(id: number | null) {
  return useQuery({
    queryKey: playlistKeys.detail(id ?? 0),
    queryFn: ({ signal }) => playlistsApi.get(id ?? 0, signal),
    enabled: id !== null,
  })
}

// A playlist's name and visibility show up in the search too, so every change refreshes both
function useInvalidatePlaylists() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: playlistKeys.all }),
      queryClient.invalidateQueries({ queryKey: searchKeys.all }),
    ])
}

export function useCreatePlaylist() {
  const invalidate = useInvalidatePlaylists()
  return useMutation({ mutationFn: playlistsApi.create, onSuccess: invalidate })
}

export function useUpdatePlaylist() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidatePlaylists()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PlaylistInput }) => playlistsApi.update(id, input),
    onSuccess: (playlist) => {
      // The answer is the new state: show it right away, then refresh the rest
      queryClient.setQueryData(playlistKeys.detail(playlist.id), playlist)
      return invalidate()
    },
  })
}

export function useDeletePlaylist() {
  const invalidate = useInvalidatePlaylists()
  return useMutation({ mutationFn: playlistsApi.remove, onSuccess: invalidate })
}

/** The playlist's musics, in its order; idle while `id` is null. */
export function usePlaylistMusics(id: number | null) {
  return useQuery({
    queryKey: playlistKeys.musics(id ?? 0),
    queryFn: ({ signal }) => playlistsApi.musics(id ?? 0, signal),
    enabled: id !== null,
  })
}

// Adding or removing changes the playlist's music count, which the search shows
function useInvalidatePlaylistMusics() {
  const queryClient = useQueryClient()
  return (id: number) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: playlistKeys.musics(id) }),
      queryClient.invalidateQueries({ queryKey: searchKeys.all }),
    ])
}

export function useAddPlaylistMusic() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidatePlaylistMusics()
  return useMutation({
    mutationFn: ({ id, musicId }: { id: number; musicId: number }) => playlistsApi.addMusic(id, musicId),
    onSuccess: (musics, { id }) => {
      queryClient.setQueryData(playlistKeys.musics(id), musics)
      return invalidate(id)
    },
  })
}

export function useRemovePlaylistMusic() {
  const invalidate = useInvalidatePlaylistMusics()
  return useMutation({
    mutationFn: ({ id, musicId }: { id: number; musicId: number }) => playlistsApi.removeMusic(id, musicId),
    onSuccess: (_, { id }) => invalidate(id),
  })
}

/**
 * Saves a new order. The list moves at once (the drag already shows it there); if the API
 * refuses, it goes back to how it was and the list is fetched again, since a refusal usually
 * means someone else changed the playlist meanwhile.
 */
export function useReorderPlaylistMusics() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, musicIds }: { id: number; musicIds: number[] }) => playlistsApi.reorderMusics(id, musicIds),
    onMutate: async ({ id, musicIds }) => {
      const key = playlistKeys.musics(id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PlaylistMusic[]>(key)
      if (previous) {
        const byId = new Map(previous.map((m) => [m.id, m]))
        const reordered = musicIds.map((musicId) => byId.get(musicId)).filter((m): m is PlaylistMusic => Boolean(m))
        queryClient.setQueryData(key, reordered)
      }
      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(playlistKeys.musics(id), context.previous)
      return queryClient.invalidateQueries({ queryKey: playlistKeys.musics(id) })
    },
    onSuccess: (musics, { id }) => queryClient.setQueryData(playlistKeys.musics(id), musics),
  })
}

/** The owner and collaborators of a playlist; idle while `id` is null. */
export function usePlaylistCollaborators(id: number | null) {
  return useQuery({
    queryKey: playlistKeys.collaborators(id ?? 0),
    queryFn: ({ signal }) => playlistsApi.collaborators(id ?? 0, signal),
    enabled: id !== null,
  })
}

// Adding or removing someone changes the collaborators and whose "Minhas playlists" has the playlist
export function useAddCollaborator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) => playlistsApi.addCollaborator(id, email),
    onSuccess: (collaborators, { id }) => queryClient.setQueryData(playlistKeys.collaborators(id), collaborators),
  })
}

/** The owner removes a collaborator: the list of who builds it changes, the playlist stays. */
export function useRemoveCollaborator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => playlistsApi.removeCollaborator(id, userId),
    onSuccess: (_result, { id }) => queryClient.invalidateQueries({ queryKey: playlistKeys.collaborators(id) }),
  })
}

/**
 * A collaborator leaves the playlist (their own id). A private one now answers 404, so its open
 * queries are only marked stale, not refetched: the page navigates away without flashing errors,
 * and a later visit loads it again. Nothing is awaited, so the navigation is not held up.
 */
export function useLeavePlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => playlistsApi.removeCollaborator(id, userId),
    onSuccess: (_result, { id }) => {
      for (const queryKey of [playlistKeys.detail(id), playlistKeys.musics(id), playlistKeys.collaborators(id)]) {
        void queryClient.invalidateQueries({ queryKey, refetchType: "none" })
      }
      void queryClient.invalidateQueries({ queryKey: playlistKeys.list() })
    },
  })
}
