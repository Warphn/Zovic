"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { SuggestionView } from "@/components/search/suggestion-renderers"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { currentTrackOf, playOrToggleTrack, useCatalogTracks, usePlayback } from "@/lib/playback-store"
import { suggestionHref } from "@/lib/search/routes"
import { toSuggestions } from "@/lib/search/suggestions"
import { SEARCH_MAX_LIMIT, useCatalogSearch } from "@/lib/api/search"

// Placeholder results page: lists every match from the catalog with the same renderers as the
// header search. The full results page (and track/artist pages) will replace this.

const RESULT_CLASSES =
  "block rounded-xl px-3 py-2 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"

// The groups the results page shows, in the order the API sends them
const GROUPS = [
  { kind: "track", label: "Músicas" },
  { kind: "artist", label: "Artistas" },
  { kind: "playlist", label: "Playlists" },
] as const

// A track row: the row plays or pauses it; next to it, the menu that adds it to a playlist
function TrackResult({
  isPlaying,
  onClick,
  title,
  actions,
  children,
}: {
  isPlaying: boolean
  onClick: () => void
  title: string
  actions: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="group flex items-center gap-1 rounded-xl pr-2 transition-colors hover:bg-muted/25">
      <button
        type="button"
        onClick={onClick}
        aria-label={isPlaying ? `Pausar ${title}` : `Tocar ${title}`}
        aria-pressed={isPlaying}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <span className="min-w-0 flex-1">{children}</span>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            isPlaying ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </span>
      </button>
      {actions}
    </div>
  )
}

function SearchResults() {
  const query = useSearchParams().get("q") ?? ""
  const catalogTracks = useCatalogTracks()
  const search = useCatalogSearch(query, SEARCH_MAX_LIMIT)
  // No text completions here: the page already shows everything that matched
  const results = React.useMemo(
    () => (search.results ? toSuggestions(search.results, search.resultsQuery, 0) : []),
    [search.results, search.resultsQuery]
  )
  const answered = Boolean(query.trim()) && search.resultsQuery === query.trim()
  // What the last "Adicionar à playlist" did, announced to screen readers too
  const [added, setAdded] = React.useState<{ message: string; ok: boolean } | null>(null)
  const playback = usePlayback()

  return (
    <div className="max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
      <h1 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">
        {query ? <>Resultados para “{query}”</> : "Busca"}
      </h1>
      {/* Always rendered, so the live region exists before the first message; it only takes
          room once there is something to say */}
      <output
        className={
          added ? `mt-3 block text-sm ${added.ok ? "text-muted-foreground" : "text-destructive"}` : "sr-only"
        }
      >
        {added?.message}
      </output>
      {search.error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {search.error}
        </p>
      ) : !query.trim() ? (
        <p className="mt-6 text-sm text-muted-foreground">Digite algo na busca acima</p>
      ) : !answered ? (
        <p className="mt-6 text-sm text-muted-foreground">Buscando…</p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nada encontrado. Tente outro nome de música, artista ou playlist.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {GROUPS.map(({ kind, label }) => {
            const items = results.filter((result) => result.kind === kind)
            if (items.length === 0) return null
            const headingId = `busca-${kind}`
            return (
              <section key={kind} aria-labelledby={headingId}>
                {/* Group label in the mono of the app's meta, with how many came back */}
                <h2 id={headingId} className="mb-2 px-3 font-mono text-xs text-muted-foreground tabular-nums">
                  {label} · {items.length}
                </h2>
                <ul className="space-y-1">
                  {items.map((result, index) => (
                    <li key={`${result.kind}-${index}`}>
                      {result.kind === "track" ? (
                        // A track plays (or pauses) right here, without leaving the results
                        <TrackResult
                          isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === result.id}
                          onClick={() => playOrToggleTrack(result.id, [result.track, ...catalogTracks])}
                          title={result.title}
                          actions={
                            <AddToPlaylistMenu
                              musicId={Number(result.id)}
                              title={result.title}
                              onResult={(message, ok) => setAdded({ message, ok })}
                            />
                          }
                        >
                          <SuggestionView suggestion={result} query={search.resultsQuery} showKind={false} />
                        </TrackResult>
                      ) : (
                        <Link href={suggestionHref(result)} className={RESULT_CLASSES}>
                          <SuggestionView suggestion={result} query={search.resultsQuery} showKind={false} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        {/* useSearchParams needs a Suspense boundary so the page can still prerender */}
        <React.Suspense fallback={null}>
          <SearchResults />
        </React.Suspense>
      </main>
    </div>
  )
}
