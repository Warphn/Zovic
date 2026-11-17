"use client"

import * as React from "react"
import Link from "next/link"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import Header from "@/components/header"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { TrackTitle } from "@/components/track-title"
import { apiErrorMessage } from "@/lib/api/client"
import { useHistory, useListenedMusicIds, useListenedMusics } from "@/lib/api/history"
import { formatDayAndTime } from "@/lib/format-date-time"
import { formatDuration } from "@/lib/format-duration"
import { currentTrackOf, playOrToggleTrack, useCatalogTracks, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"
import { playButtonLabel } from "@/lib/track-label"
import { TrackDislikeButton } from "@/components/track-dislike-button"
import { TrackLikeButton } from "@/components/track-like-button"

/** One row of either tab: a music and when it was last heard (played, or listened past 30 s). */
interface HistoryItem {
  musicId: number
  name: string
  duration: number
  artists: { id: number; name: string }[]
  isAvailable: boolean
  heardAt: string
}

const HISTORY_TABS = [
  { id: "todas", label: "Todas" },
  { id: "ouvidas", label: "Já ouvidas" },
] as const

type HistoryTabId = (typeof HISTORY_TABS)[number]["id"]

function itemMeta(item: HistoryItem): string {
  const artists = item.artists.map((artist) => artist.name).join(", ")
  return [artists, formatDuration(item.duration), `Ouvida em ${formatDayAndTime(item.heardAt)}`]
    .filter(Boolean)
    .join(" · ")
}

// A removed music stays in the history, but is muted and cannot be played
function UnavailableRow({ item }: { item: HistoryItem }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2 opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{itemMeta(item)}</span>
      </span>
      <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
        Indisponível
      </span>
    </div>
  )
}

function PlayableRow({
  item,
  showListenedMark,
  isPlaying,
  onClick,
}: {
  item: HistoryItem
  showListenedMark: boolean
  isPlaying: boolean
  onClick: () => void
}) {
  const listenedMusicIds = useListenedMusicIds()
  const isListened = showListenedMark && listenedMusicIds.has(item.musicId)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playButtonLabel(item.name, { isPlaying, isListened })}
      aria-pressed={isPlaying}
      className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      <span className="min-w-0 flex-1">
        <TrackTitle title={item.name} musicId={showListenedMark ? item.musicId : null} />
        <span className="block truncate text-xs text-muted-foreground">{itemMeta(item)}</span>
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

function HistoryList({
  items,
  isPending,
  error,
  emptyMessage,
  showListenedMark,
}: {
  items: HistoryItem[] | undefined
  isPending: boolean
  error: Error | null
  emptyMessage: string
  showListenedMark: boolean
}) {
  const catalogTracks = useCatalogTracks()
  const playback = usePlayback()
  // What the last "Adicionar à fila" or "Adicionar à playlist" did, announced to screen readers too
  const [queued, setQueued] = React.useState<string | null>(null)

  if (error) {
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {apiErrorMessage(error)}
      </p>
    )
  }
  if (isPending || !items) return <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
  if (items.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        {emptyMessage}{" "}
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
      <ul className="mt-6 space-y-1">
        {items.map((item) => {
          const track = musicToTrack({ id: item.musicId, name: item.name, duration: item.duration, artists: item.artists })
          return (
            <li key={item.musicId} className="flex items-center gap-1">
              {item.isAvailable ? (
                <>
                  <PlayableRow
                    item={item}
                    showListenedMark={showListenedMark}
                    isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                    onClick={() => playOrToggleTrack(track.id, [track, ...catalogTracks])}
                  />
                  {/* Beside the row, never inside it: the row is a button of its own */}
                  <AddToQueueButton track={track} onResult={setQueued} />
                  <TrackLikeButton trackId={track.id} />
                  <TrackDislikeButton trackId={track.id} />
                  <AddToPlaylistMenu musicId={item.musicId} title={item.name} onResult={setQueued} />
                </>
              ) : (
                <UnavailableRow item={item} />
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function AllPlayedList() {
  const { data: entries, isPending, error } = useHistory()
  const items = entries?.map(({ lastPlayedAt, ...music }) => ({ ...music, heardAt: lastPlayedAt }))
  return (
    <HistoryList
      items={items}
      isPending={isPending}
      error={error}
      emptyMessage="Você ainda não ouviu nenhuma música."
      showListenedMark
    />
  )
}

// HU-15: only the musics that played for more than 30 seconds in one listen
function ListenedList() {
  const { data: entries, isPending, error } = useListenedMusics()
  const items = entries?.map(({ lastListenedAt, ...music }) => ({ ...music, heardAt: lastListenedAt }))
  return (
    <HistoryList
      items={items}
      isPending={isPending}
      error={error}
      emptyMessage="Você ainda não ouviu nenhuma música por mais de 30 segundos."
      showListenedMark={false}
    />
  )
}

function HistoryTabs({ selected, onSelect }: { selected: HistoryTabId; onSelect: (tab: HistoryTabId) => void }) {
  const tabRefs = React.useRef(new Map<HistoryTabId, HTMLButtonElement>())

  // Left and right move between the tabs, as in any tab list
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const currentIndex = HISTORY_TABS.findIndex((tab) => tab.id === selected)
    const step = event.key === "ArrowRight" ? 1 : -1
    const next = HISTORY_TABS[(currentIndex + step + HISTORY_TABS.length) % HISTORY_TABS.length]
    onSelect(next.id)
    tabRefs.current.get(next.id)?.focus()
  }

  return (
    <div role="tablist" aria-label="Histórico" className="mt-6 flex gap-1 border-b border-border">
      {HISTORY_TABS.map((tab) => {
        const isSelected = tab.id === selected
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) tabRefs.current.set(tab.id, element)
              else tabRefs.current.delete(tab.id)
            }}
            type="button"
            role="tab"
            id={`historico-aba-${tab.id}`}
            aria-selected={isSelected}
            aria-controls={`historico-painel-${tab.id}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={handleKeyDown}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
              isSelected
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function HistoryPage() {
  const [selectedTab, setSelectedTab] = React.useState<HistoryTabId>("todas")

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
          <h1 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">Histórico</h1>
          <p className="mt-2 text-sm text-muted-foreground">As músicas que você ouviu, da mais recente para a mais antiga.</p>
          <HistoryTabs selected={selectedTab} onSelect={setSelectedTab} />
          <div role="tabpanel" id={`historico-painel-${selectedTab}`} aria-labelledby={`historico-aba-${selectedTab}`}>
            {selectedTab === "todas" ? <AllPlayedList /> : <ListenedList />}
          </div>
        </div>
      </main>
    </div>
  )
}
