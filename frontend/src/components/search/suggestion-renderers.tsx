"use client"

import * as React from "react"
import { SearchIcon } from "@/components/icons"
import { getContrastTextColor } from "@/components/color-picker"
import { getPlaylistInitials } from "@/lib/playlist-store"
import { normalize, type SearchSuggestion, type SuggestionKind } from "@/lib/search/suggestions"
import { cn } from "@/lib/utils"

// One component per suggestion kind. The search box only knows this registry, so a new kind
// (album, genre…) is a new entry here plus its type in lib/search/suggestions.

type RendererProps<K extends SuggestionKind> = {
  suggestion: Extract<SearchSuggestion, { kind: K }>
  query: string
}

export type SuggestionRenderers = { [K in SuggestionKind]: React.ComponentType<RendererProps<K>> }

/** Bolds the part of `text` that matches `query` (accent-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query)
  // normalize() keeps one char per char for Latin text, so indexes line up with `text`
  const index = q ? normalize(text).indexOf(q) : -1
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-bold text-foreground">{text.slice(index, index + q.length)}</strong>
      {text.slice(index + q.length)}
    </>
  )
}

function Row({ media, title, subtitle }: { media: React.ReactNode; title: React.ReactNode; subtitle?: string }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      {media}
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground/90">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  )
}

function Cover({ label, color, round }: { label: string; color: string; round?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center text-xs font-black border border-black/10",
        round ? "rounded-full" : "rounded-md",
        getContrastTextColor(color)
      )}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

export const SUGGESTION_RENDERERS: SuggestionRenderers = {
  query: ({ suggestion, query }) => (
    <Row
      media={
        <span className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
          <SearchIcon size={16} animateOnHover={false} />
        </span>
      }
      title={<Highlight text={suggestion.text} query={query} />}
    />
  ),
  track: ({ suggestion, query }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.title)} color="#171512" />}
      title={<Highlight text={suggestion.title} query={query} />}
      subtitle={`Música • ${suggestion.artist}`}
    />
  ),
  artist: ({ suggestion, query }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.name)} color="#565043" round />}
      title={<Highlight text={suggestion.name} query={query} />}
      subtitle={`Artista • ${suggestion.trackCount} ${suggestion.trackCount === 1 ? "música" : "músicas"}`}
    />
  ),
  playlist: ({ suggestion, query }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.name)} color={suggestion.color} />}
      title={<Highlight text={suggestion.name} query={query} />}
      subtitle={`Playlist • ${suggestion.trackCount} ${suggestion.trackCount === 1 ? "faixa" : "faixas"}`}
    />
  ),
}

export function SuggestionView({ suggestion, query }: { suggestion: SearchSuggestion; query: string }) {
  // The registry is keyed by kind, so this lookup always matches the suggestion's type
  const Renderer = SUGGESTION_RENDERERS[suggestion.kind] as React.ComponentType<{
    suggestion: SearchSuggestion
    query: string
  }>
  return <Renderer suggestion={suggestion} query={query} />
}
