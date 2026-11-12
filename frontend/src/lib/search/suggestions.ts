import type { SearchResults } from "@/lib/api/search"
import { DEFAULT_PLAYLIST_COLOR, musicToTrack, type Track } from "@/lib/playlist-store"

// What the search shows, built from GET /api/search. Each kind is rendered by its own component
// (see components/search/suggestion-renderers), so adding a kind means adding a type here,
// producing it in toSuggestions and registering a renderer.

export type QuerySuggestion = { kind: "query"; text: string }
/** Carries the whole track, so picking it plays it right away. */
export type TrackSuggestion = { kind: "track"; id: string; title: string; artist: string; track: Track }
export type ArtistSuggestion = { kind: "artist"; id: number; name: string; trackCount: number }
export type AlbumSuggestion = {
  kind: "album"
  id: number
  name: string
  /** "Artista · ano", whichever of the two the album has. */
  subtitle: string
  coverUrl: string | null
}
export type PlaylistSuggestion = { kind: "playlist"; id: string; name: string; color: string; trackCount: number }

export type SearchSuggestion =
  | QuerySuggestion
  | TrackSuggestion
  | ArtistSuggestion
  | AlbumSuggestion
  | PlaylistSuggestion
export type SuggestionKind = SearchSuggestion["kind"]

const DEFAULT_QUERY_COUNT = 3

/** Lowercase without accents, so "agua" finds "Águas". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

/**
 * Suggestions for `rawQuery` from the API results, already ranked and capped by the API:
 * up to `queryCount` text completions (names that start with what was typed), then tracks,
 * artists, albums and playlists.
 */
export function toSuggestions(
  results: SearchResults,
  rawQuery: string,
  queryCount = DEFAULT_QUERY_COUNT
): SearchSuggestion[] {
  const query = normalize(rawQuery)
  if (!query) return []

  const tracks: TrackSuggestion[] = results.musics.map((music) => {
    const track = musicToTrack(music)
    return { kind: "track", id: track.id, title: track.title, artist: track.artist, track }
  })
  const artists: ArtistSuggestion[] = results.artists.map((a) => ({
    kind: "artist",
    id: a.id,
    name: a.name,
    trackCount: a.musicCount,
  }))
  const albums: AlbumSuggestion[] = results.albums.map((album) => ({
    kind: "album",
    id: album.id,
    name: album.name,
    subtitle: [album.artists.map((artist) => artist.name).join(", "), album.year].filter(Boolean).join(" · "),
    coverUrl: album.coverUrl,
  }))
  const playlists: PlaylistSuggestion[] = results.playlists.map((p) => ({
    kind: "playlist",
    id: String(p.id),
    name: p.name,
    color: p.color ?? DEFAULT_PLAYLIST_COLOR,
    trackCount: p.musicCount,
  }))

  const names = [
    ...tracks.map((t) => t.title),
    ...artists.map((a) => a.name),
    ...albums.map((album) => album.name),
    ...playlists.map((p) => p.name),
  ]
  const queries: QuerySuggestion[] = [...new Set(names)]
    .filter((text) => normalize(text).startsWith(query) && normalize(text) !== query)
    .toSorted((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, queryCount)
    .map((text) => ({ kind: "query", text }))

  return [...queries, ...tracks, ...artists, ...albums, ...playlists]
}
