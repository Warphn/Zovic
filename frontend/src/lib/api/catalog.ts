import { useQuery } from "@tanstack/react-query"
import { queryString, request } from "./client"
import type { SearchMusic } from "./search"

// The catalog every signed-in user reads: /api/musics, /api/artists, /api/genres, plus recording
// a play (api/adapters/http/admin-controller.ts, makeCatalogController).

export interface NamedItem {
  id: number
  name: string
}

export interface Genre extends NamedItem {
  color: string
}

export interface Album extends NamedItem {
  /** Null only for albums older than the column. */
  year: number | null
  artists: NamedItem[]
  /** Active tracks of the album. */
  musicCount: number
  /** API path of the cover image (load it through `apiUrl`); null for older albums without one. */
  coverUrl: string | null
}

export interface CatalogMusic extends SearchMusic {
  streams: number
  plays: number
  genres: Genre[]
  /** The music's active album, if any. */
  album: { id: number; name: string; year: number | null } | null
  isExplicit: boolean
  /** Musics older than the upload have no audio file. */
  hasAudio: boolean
  /** ISO date-time. */
  createdAt: string
  /** Set only for an admin, who also gets the removed musics. */
  deletedAt: string | null
}

export const catalogApi = {
  /** Active musics; for an admin, the removed ones too. `q` filters by music or artist name. */
  musics: (q?: string, signal?: AbortSignal) =>
    request<CatalogMusic[]>(`/musics${queryString({ q: q?.trim() || undefined })}`, { signal }),
  artists: (signal?: AbortSignal) => request<NamedItem[]>("/artists", { signal }),
  genres: (signal?: AbortSignal) => request<Genre[]>("/genres", { signal }),
  albums: (signal?: AbortSignal) => request<Album[]>("/albums", { signal }),
  /** Counts one play of the music for the viewer (event + stream count). */
  recordPlay: (musicId: number) => request<void>(`/musics/${musicId}/plays`, { method: "POST" }),
}

export const catalogKeys = {
  all: ["catalog"] as const,
  musics: (q = "") => [...catalogKeys.all, "musics", q.trim()] as const,
  artists: () => [...catalogKeys.all, "artists"] as const,
  genres: () => [...catalogKeys.all, "genres"] as const,
  albums: () => [...catalogKeys.all, "albums"] as const,
}

/** The whole catalog; it changes rarely (admin edits invalidate it), so it stays fresh until then. */
export function useCatalogMusics() {
  return useQuery({
    queryKey: catalogKeys.musics(),
    queryFn: ({ signal }) => catalogApi.musics(undefined, signal),
    staleTime: Infinity,
  })
}

export function useArtists() {
  return useQuery({ queryKey: catalogKeys.artists(), queryFn: ({ signal }) => catalogApi.artists(signal) })
}

export function useAlbums() {
  return useQuery({ queryKey: catalogKeys.albums(), queryFn: ({ signal }) => catalogApi.albums(signal) })
}

export function useGenres() {
  return useQuery({ queryKey: catalogKeys.genres(), queryFn: ({ signal }) => catalogApi.genres(signal) })
}
