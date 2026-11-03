"use client"
// ARIA combobox pattern: the options hold rich content (covers, two lines) that a native
// <select>/<datalist> cannot render, so listbox/option roles are set by hand.
// oxlint-disable jsx-a11y/prefer-tag-over-role

import * as React from "react"
import { useRouter } from "next/navigation"
import { CloseIcon, SearchIcon } from "@/components/icons"
import { useStoredPlaylists } from "@/lib/playlist-store"
import { searchHref, suggestionHref, suggestionText } from "@/lib/search/routes"
import { getSuggestions, type SearchSuggestion } from "@/lib/search/suggestions"
import { cn } from "@/lib/utils"
import { SuggestionView } from "./suggestion-renderers"

const LISTBOX_ID = "header-search-suggestions"
const optionId = (index: number) => `${LISTBOX_ID}-${index}`

// Header search box (ARIA combobox): suggestions appear while typing; arrows move through
// them, Enter opens the highlighted one (or the results page), Escape closes.
export function SearchBar({ className }: { className?: string }) {
  const router = useRouter()
  const { playlists } = useStoredPlaylists()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)

  const suggestions = React.useMemo(() => getSuggestions(query, playlists), [query, playlists])
  const showList = open && suggestions.length > 0

  const go = (href: string, text: string) => {
    setQuery(text)
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
    router.push(href)
  }

  const pick = (suggestion: SearchSuggestion) => go(suggestionHref(suggestion), suggestionText(suggestion))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return
      e.preventDefault()
      setOpen(true)
      const step = e.key === "ArrowDown" ? 1 : -1
      // -1 (nothing highlighted) is part of the cycle, so the typed text stays reachable
      setActiveIndex((i) => ((i + 1 + step + suggestions.length + 1) % (suggestions.length + 1)) - 1)
    } else if (e.key === "Enter") {
      const active = showList ? suggestions[activeIndex] : undefined
      if (active) pick(active)
      else if (query.trim()) go(searchHref(query), query.trim())
      e.preventDefault()
    } else if (e.key === "Escape") {
      if (showList) setOpen(false)
      else setQuery("")
      setActiveIndex(-1)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        size={16}
        animateOnHover={false}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Buscar músicas, artistas e playlists"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="O que você quer ouvir?"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="h-10 w-full rounded-full border border-border bg-surface/90 pl-10 pr-10 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          aria-label="Limpar busca"
          // mousedown keeps focus in the input, so the list does not close and reopen
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("")
            setActiveIndex(-1)
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <CloseIcon size={14} />
        </button>
      )}

      {showList && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Sugestões"
          className="absolute left-0 right-0 top-full mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.kind}-${suggestionText(suggestion)}-${index}`}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              // mousedown, not click: it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                pick(suggestion)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "cursor-pointer rounded-xl px-2.5 py-1.5",
                index === activeIndex ? "bg-muted/40" : "hover:bg-muted/25"
              )}
            >
              <SuggestionView suggestion={suggestion} query={query} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
