import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import type { Album } from "./catalog"
import { apiErrorMessage, queryString, request } from "./client"

// GET /api/search: músicas, artistas, álbuns e playlists que casam com o termo (api/domain/ports/search-query.ts).

export interface SearchMusic {
  id: number
  name: string
  /** Seconds. */
  duration: number
  artists: { id: number; name: string }[]
}

export interface SearchResults {
  musics: SearchMusic[]
  artists: { id: number; name: string; musicCount: number }[]
  albums: Album[]
  playlists: { id: number; name: string; isPrivate: boolean; color: string | null; musicCount: number }[]
}

/** Most items per group the API returns (SEARCH_LIMIT.max in the API). */
export const SEARCH_MAX_LIMIT = 50

const DEBOUNCE_MS = 200

export const searchApi = {
  path: (term: string, limit?: number) => `/search${queryString({ q: term.trim(), limit })}`,
  search: (term: string, limit?: number, signal?: AbortSignal) =>
    request<SearchResults>(searchApi.path(term, limit), { signal }),
}

export const searchKeys = {
  all: ["search"] as const,
  results: (term: string, limit?: number) => [...searchKeys.all, term, limit ?? null] as const,
}

export interface CatalogSearch {
  /** Results for the last query answered; null before the first one and for a blank query. */
  results: SearchResults | null
  /** The query `results` answer. */
  resultsQuery: string
  /** True while the current query has no answer yet. */
  loading: boolean
  /** Why the current query failed, if it did. */
  error: string | null
}

// Searches the catalog as `query` changes: waits for a pause in typing, and keeps the previous
// results on screen until the new ones arrive (a superseded request is cancelled by the query).
export function useCatalogSearch(query: string, limit?: number): CatalogSearch {
  const current = query.trim()
  const term = useDebouncedValue(current, DEBOUNCE_MS)
  const search = useQuery({
    queryKey: searchKeys.results(term, limit),
    queryFn: async ({ signal }) => ({ term, results: await searchApi.search(term, limit, signal) }),
    enabled: term !== "",
    placeholderData: keepPreviousData,
  })

  if (!current) return { results: null, resultsQuery: "", loading: false, error: null }
  const failed = search.isError && term === current
  const answered = !search.isPlaceholderData && search.data?.term === current
  return {
    results: search.data?.results ?? null,
    resultsQuery: search.data?.term ?? "",
    loading: !answered && !failed,
    error: failed ? apiErrorMessage(search.error) : null,
  }
}
