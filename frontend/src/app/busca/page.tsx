"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { SuggestionView } from "@/components/search/suggestion-renderers"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { playOrToggleTrack, usePlayback } from "@/lib/playback-store"
import { uniqueTracks, useStoredPlaylists } from "@/lib/playlist-store"
import { suggestionHref } from "@/lib/search/routes"
import { getSuggestions } from "@/lib/search/suggestions"

// Placeholder results page: lists every match with the same renderers as the header search.
// The full results page (and track/artist pages) will replace this.
const RESULT_LIMITS = { queries: 0, tracks: 50, artists: 50, playlists: 50 }

const RESULT_CLASSES =
  "block rounded-xl px-3 py-2 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function TrackResult({
  isPlaying,
  onClick,
  title,
  children,
}: {
  isPlaying: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPlaying ? `Pausar ${title}` : `Tocar ${title}`}
      aria-pressed={isPlaying}
      className={`${RESULT_CLASSES} group flex w-full cursor-pointer items-center gap-3 text-left`}
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
  )
}

function SearchResults() {
  const query = useSearchParams().get("q") ?? ""
  const { playlists } = useStoredPlaylists()
  const results = React.useMemo(() => getSuggestions(query, playlists, RESULT_LIMITS), [query, playlists])
  const playback = usePlayback()

  return (
    <div className="max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
        {query ? <>Resultados para “{query}”</> : "Busca"}
      </h1>
      {results.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {query ? "Nada encontrado. Tente outro nome de música, artista ou playlist." : "Digite algo na busca acima."}
        </p>
      ) : (
        <ul className="mt-8 space-y-1">
          {results.map((result, index) => (
            <li key={`${result.kind}-${index}`}>
              {result.kind === "track" ? (
                // A track plays (or pauses) right here, without leaving the results
                <TrackResult
                  isPlaying={Boolean(playback?.isPlaying) && playback?.currentTrackId === result.id}
                  onClick={() => playOrToggleTrack(result.id, uniqueTracks(playlists))}
                  title={result.title}
                >
                  <SuggestionView suggestion={result} query={query} />
                </TrackResult>
              ) : (
                <Link href={suggestionHref(result)} className={RESULT_CLASSES}>
                  <SuggestionView suggestion={result} query={query} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
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
