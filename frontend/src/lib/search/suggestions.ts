import type { PlaylistData } from "@/lib/playlist-store"

// Suggestions the header search can show while the user types. Each kind is rendered by its
// own component (see components/search/suggestion-renderers), so adding a kind means adding
// a type here, producing it in getSuggestions and registering a renderer.

export type QuerySuggestion = { kind: "query"; text: string }
export type TrackSuggestion = { kind: "track"; id: string; title: string; artist: string; playlistId: string }
export type ArtistSuggestion = { kind: "artist"; name: string; trackCount: number }
export type PlaylistSuggestion = { kind: "playlist"; id: string; name: string; color: string; trackCount: number }

export type SearchSuggestion = QuerySuggestion | TrackSuggestion | ArtistSuggestion | PlaylistSuggestion
export type SuggestionKind = SearchSuggestion["kind"]

export interface SuggestionLimits {
  queries: number
  tracks: number
  artists: number
  playlists: number
}

const DEFAULT_LIMITS: SuggestionLimits = { queries: 3, tracks: 4, artists: 3, playlists: 3 }

/** Lowercase without accents, so "agua" finds "Águas". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

// 0 = the whole text starts with the query, 1 = a word does, 2 = it appears inside a word,
// null = no match. Lower ranks are shown first.
function matchRank(text: string, query: string): number | null {
  const haystack = normalize(text)
  if (haystack.startsWith(query)) return 0
  if (haystack.split(/[\s,.\-&/]+/).some((word) => word.startsWith(query))) return 1
  if (haystack.includes(query)) return 2
  return null
}

function ranked<T>(items: T[], textOf: (item: T) => string, query: string, limit: number): T[] {
  return items
    .map((item) => ({ item, rank: matchRank(textOf(item), query) }))
    .filter((entry): entry is { item: T; rank: number } => entry.rank !== null)
    .toSorted((a, b) => a.rank - b.rank || textOf(a.item).localeCompare(textOf(b.item), "pt-BR"))
    .slice(0, limit)
    .map((entry) => entry.item)
}

const splitArtists = (credit: string) =>
  credit
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

/** Suggestions for `rawQuery` from the user's playlists; empty when the query is blank. */
export function getSuggestions(
  rawQuery: string,
  playlists: PlaylistData[],
  limits: Partial<SuggestionLimits> = {}
): SearchSuggestion[] {
  const query = normalize(rawQuery)
  if (!query) return []
  const max = { ...DEFAULT_LIMITS, ...limits }

  // Same track can sit in several playlists: keep the first occurrence
  const tracks = new Map<string, TrackSuggestion>()
  const artists = new Map<string, ArtistSuggestion>()
  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      if (tracks.has(track.id)) continue
      tracks.set(track.id, {
        kind: "track",
        id: track.id,
        title: track.title,
        artist: track.artist,
        playlistId: playlist.id,
      })
      for (const name of splitArtists(track.artist)) {
        const existing = artists.get(name)
        artists.set(name, { kind: "artist", name, trackCount: (existing?.trackCount ?? 0) + 1 })
      }
    }
  }

  const playlistItems: PlaylistSuggestion[] = playlists.map((p) => ({
    kind: "playlist",
    id: p.id,
    name: p.name,
    color: p.color,
    trackCount: p.tracks.length,
  }))

  // Text completions: track, artist and playlist names that start with what was typed
  const completionTexts = [
    ...new Set([...[...tracks.values()].map((t) => t.title), ...artists.keys(), ...playlistItems.map((p) => p.name)]),
  ]
  const queries: QuerySuggestion[] = completionTexts
    .filter((text) => matchRank(text, query) === 0 && normalize(text) !== query)
    .toSorted((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, max.queries)
    .map((text) => ({ kind: "query", text }))

  return [
    ...queries,
    ...ranked([...tracks.values()], (t) => `${t.title} ${t.artist}`, query, max.tracks),
    ...ranked([...artists.values()], (a) => a.name, query, max.artists),
    ...ranked(playlistItems, (p) => p.name, query, max.playlists),
  ]
}
