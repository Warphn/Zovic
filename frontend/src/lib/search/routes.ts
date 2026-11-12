import type { SearchSuggestion } from "./suggestions"

// Where each suggestion leads. Tracks have no page of their own yet: they are played in place by
// the search bar and the results page (their href, the results for the title, is only a
// fallback). When the track page exists, only this file changes.

export const SEARCH_PATH = "/busca"

export function searchHref(query: string): string {
  return `${SEARCH_PATH}?q=${encodeURIComponent(query.trim())}`
}

export function suggestionHref(suggestion: SearchSuggestion): string {
  switch (suggestion.kind) {
    case "query":
      return searchHref(suggestion.text)
    case "track":
      return searchHref(suggestion.title)
    case "artist":
      return `/artista/${suggestion.id}`
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
