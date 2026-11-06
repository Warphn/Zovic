"use client"

import * as React from "react"
import Link from "next/link"
import Header from "@/components/header"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { apiErrorMessage } from "@/lib/api/client"
import { type HistoryEntry, useHistory } from "@/lib/api/history"
import { formatDayAndTime } from "@/lib/format-date-time"
import { formatDuration } from "@/lib/format-duration"
import { currentTrackOf, playOrToggleTrack, useCatalogTracks, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

function entryMeta(entry: HistoryEntry): string {
  const artists = entry.artists.map((artist) => artist.name).join(", ")
  return [artists, formatDuration(entry.duration), `Ouvida em ${formatDayAndTime(entry.lastPlayedAt)}`]
    .filter(Boolean)
    .join(" · ")
}

// A removed music stays in the history, but is muted and cannot be played
function UnavailableRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 opacity-60">
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
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
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
    <ul className="mt-8 space-y-1">
      {entries.map((entry) => (
        <li key={entry.musicId}>
          {entry.isAvailable ? (
            <PlayableRow
              entry={entry}
              isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === String(entry.musicId)}
              onClick={() =>
                playOrToggleTrack(String(entry.musicId), [
                  musicToTrack({ id: entry.musicId, name: entry.name, duration: entry.duration, artists: entry.artists }),
                  ...catalogTracks,
                ])
              }
            />
          ) : (
            <UnavailableRow entry={entry} />
          )}
        </li>
      ))}
    </ul>
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
