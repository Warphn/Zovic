"use client"

import * as React from "react"
import Link from "next/link"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import Header from "@/components/header"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { apiErrorMessage } from "@/lib/api/client"
import { type HistoryEntry, useHistory } from "@/lib/api/history"
import { formatDayAndTime } from "@/lib/format-date-time"
import { formatDuration } from "@/lib/format-duration"
import { currentTrackOf, playOrToggleTrack, useCatalogTracks, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"
import { TrackLikeButton } from "@/components/track-like-button"

function entryMeta(entry: HistoryEntry): string {
  const artists = entry.artists.map((artist) => artist.name).join(", ")
  return [artists, formatDuration(entry.duration), `Ouvida em ${formatDayAndTime(entry.lastPlayedAt)}`]
    .filter(Boolean)
    .join(" · ")
}

// A removed music stays in the history, but is muted and cannot be played
function UnavailableRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2 opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{entry.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{entryMeta(entry)}</span>
      </span>
      <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
        Indisponível
      </span>
    </div>
  )
}

function PlayableRow({ entry, isPlaying, onClick }: { entry: HistoryEntry; isPlaying: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPlaying ? `Pausar ${entry.name}` : `Tocar ${entry.name}`}
      aria-pressed={isPlaying}
      className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{entry.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{entryMeta(entry)}</span>
      </span>
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

function HistoryList() {
  const { data: entries, isPending, error } = useHistory()
  const catalogTracks = useCatalogTracks()
  const playback = usePlayback()
  // What the last "Adicionar à fila" did, announced to screen readers too
  const [queued, setQueued] = React.useState<string | null>(null)

  if (error) {
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {apiErrorMessage(error)}
      </p>
    )
  }
  if (isPending) return <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
  if (entries.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Você ainda não ouviu nenhuma música.{" "}
        <Link href="/busca" className="font-semibold text-foreground underline underline-offset-2">
          Buscar músicas
        </Link>
      </p>
    )
  }

  return (
    <>
      {/* Always rendered, so the live region exists before the first message */}
      <output className={queued ? "mt-3 block text-sm text-muted-foreground" : "sr-only"}>{queued}</output>
      <ul className="mt-8 space-y-1">
        {entries.map((entry) => {
          const track = musicToTrack({ id: entry.musicId, name: entry.name, duration: entry.duration, artists: entry.artists })
          return (
            <li key={entry.musicId} className="flex items-center gap-1">
              {entry.isAvailable ? (
                <>
                  <PlayableRow
                    entry={entry}
                    isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                    onClick={() => playOrToggleTrack(track.id, [track, ...catalogTracks])}
                  />
                  {/* Beside the row, never inside it: the row is a button of its own */}
                  <AddToQueueButton track={track} onResult={setQueued} />
                  <TrackLikeButton trackId={track.id} />
                </>
              ) : (
                <UnavailableRow entry={entry} />
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function HistoryPage() {
  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
          <h1 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">Histórico</h1>
          <p className="mt-2 text-sm text-muted-foreground">As músicas que você ouviu, da mais recente para a mais antiga.</p>
          <HistoryList />
        </div>
      </main>
    </div>
  )
}
