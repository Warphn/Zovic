import type { SearchSuggestion } from "./suggestions"

// Where each suggestion leads. Tracks and artists have no pages of their own yet: tracks open
// the playlist they are in and artists open the results page. When those pages exist, only
// this file changes.

export const SEARCH_PATH = "/busca"

export function searchHref(query: string): string {
  return `${SEARCH_PATH}?q=${encodeURIComponent(query.trim())}`
}

export function suggestionHref(suggestion: SearchSuggestion): string {
  switch (suggestion.kind) {
    case "query":
      return searchHref(suggestion.text)
    case "track":
      return `/playlist/${suggestion.playlistId}`
    case "artist":
      return searchHref(suggestion.name)
    case "playlist":
      return `/playlist/${suggestion.id}`
  }
}

/** Text the search box keeps after picking a suggestion. */
export function suggestionText(suggestion: SearchSuggestion): string {
  switch (suggestion.kind) {
    case "query":
      return suggestion.text
    case "track":
      return suggestion.title
    case "artist":
      return suggestion.name
    case "playlist":
      return suggestion.name
  }
}
