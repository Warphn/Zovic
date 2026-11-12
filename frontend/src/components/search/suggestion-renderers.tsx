"use client"

import * as React from "react"
import { SearchIcon } from "@/components/icons"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { getContrastTextColor } from "@/components/color-picker"
import { getPlaylistInitials } from "@/lib/playlist-store"
import { normalize, type SearchSuggestion, type SuggestionKind } from "@/lib/search/suggestions"
import { cn } from "@/lib/utils"

// One component per suggestion kind. The search box only knows this registry, so a new kind
// (genre…) is a new entry here plus its type in lib/search/suggestions.

type RendererProps<K extends SuggestionKind> = {
  suggestion: Extract<SearchSuggestion, { kind: K }>
  query: string
  /** Start the subtitle with the kind ("Música · …"); off where a group heading already says it. */
  showKind: boolean
}

// "Música · Maré Alta", or just "Maré Alta" under a heading that already names the kind
const subtitleOf = (kind: string, text: string, showKind: boolean) => (showKind ? `${kind} · ${text}` : text)

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
      <strong className="font-medium text-foreground">{text.slice(index, index + q.length)}</strong>
      {text.slice(index + q.length)}
    </>
  )
}

function Row({ media, title, subtitle }: { media: React.ReactNode; title: React.ReactNode; subtitle?: string }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      {media}
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground/80">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  )
}

// A small sleeve, like the playlist page's: the cover color with the sleeve's printed frame
// (a round one for artists, who have no sleeve)
function Cover({ label, color, round }: { label: string; color: string; round?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center border border-black/10 text-[11px] font-medium",
        round ? "rounded-full" : "rounded-md",
        getContrastTextColor(color)
      )}
      style={{ backgroundColor: color }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-[2px] border border-current opacity-25",
          round ? "rounded-full" : "rounded-[4px]"
        )}
      />
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
  track: ({ suggestion, query, showKind }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.title)} color="#171512" />}
      title={<Highlight text={suggestion.title} query={query} />}
      subtitle={subtitleOf("Música", suggestion.artist, showKind)}
    />
  ),
  artist: ({ suggestion, query, showKind }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.name)} color="#565043" round />}
      title={<Highlight text={suggestion.name} query={query} />}
      subtitle={subtitleOf("Artista", `${suggestion.trackCount} ${suggestion.trackCount === 1 ? "música" : "músicas"}`, showKind)}
    />
  ),
  album: ({ suggestion, query, showKind }) => (
    <Row
      media={<AlbumCoverImage album={suggestion} className="size-9 shrink-0 rounded-md text-[11px]" />}
      title={<Highlight text={suggestion.name} query={query} />}
      subtitle={subtitleOf("Álbum", suggestion.subtitle, showKind)}
    />
  ),
  playlist: ({ suggestion, query, showKind }) => (
    <Row
      media={<Cover label={getPlaylistInitials(suggestion.name)} color={suggestion.color} />}
      title={<Highlight text={suggestion.name} query={query} />}
      subtitle={subtitleOf("Playlist", `${suggestion.trackCount} ${suggestion.trackCount === 1 ? "faixa" : "faixas"}`, showKind)}
    />
  ),
}

export function SuggestionView({
  suggestion,
  query,
  showKind = true,
}: {
  suggestion: SearchSuggestion
  query: string
  showKind?: boolean
}) {
  // The registry is keyed by kind, so this lookup always matches the suggestion's type
  const Renderer = SUGGESTION_RENDERERS[suggestion.kind] as React.ComponentType<{
    suggestion: SearchSuggestion
    query: string
    showKind: boolean
  }>
  return <Renderer suggestion={suggestion} query={query} showKind={showKind} />
}
