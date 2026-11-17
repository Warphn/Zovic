"use client"

import * as React from "react"
import Link from "next/link"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { TrackCommentsButton } from "@/components/comments/track-comments-button"
import Header from "@/components/header"
import { PlayIcon, SearchIcon } from "@/components/icons"
import { SortableList } from "@/components/sortable-list"
import { TrackDislikeButton } from "@/components/track-dislike-button"
import { TrackLikeButton } from "@/components/track-like-button"
import { TrackRow } from "@/components/track-row"
import { TrackTitle } from "@/components/track-title"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/api/client"
import { currentTrackOf, usePlayback } from "@/lib/playback-store"
import type { Track } from "@/lib/playlist-store"

// The pages of one item with a track list (album, genre, artist, playlist): the same frame,
// states, header and track list

/** A track row is a fixed 56px in the drag-to-reorder list, which cannot grow rows with their content. */
const SORTABLE_ROW_HEIGHT = 56

function CatalogPageShell({ style, children }: { style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col bg-background font-sans text-foreground selection:bg-primary/20 selection:text-foreground"
      style={style}
    >
      <Header />
      <main className="flex-1 pt-16">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8">{children}</div>
      </main>
    </div>
  )
}

/**
 * The frame of a catalog page, with its "não encontrado", error and loading states.
 * `children` runs only once the item and its data have loaded.
 */
export function CatalogPage({
  notFoundTitle,
  notFoundMessage = "Ele pode ter sido removido, ou o link está incorreto.",
  back = { href: "/inicio", label: "Voltar ao início" },
  isNotFound,
  error,
  isLoading,
  style,
  children,
}: {
  /** "Álbum não encontrado". */
  notFoundTitle: string
  notFoundMessage?: string
  /** Where "não encontrado" sends the visitor back to. */
  back?: { href: string; label: string }
  isNotFound: boolean
  error: Error | null
  isLoading: boolean
  /** On the whole page, like a playlist's accent color. */
  style?: React.CSSProperties
  children: () => React.ReactNode
}) {
  if (isNotFound) {
    return (
      <CatalogPageShell>
        <h1 className="text-2xl font-medium">{notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{notFoundMessage}</p>
        <Link href={back.href} className={`${buttonVariants({ size: "lg" })} mt-6`}>
          {back.label}
        </Link>
      </CatalogPageShell>
    )
  }
  if (error) {
    return (
      <CatalogPageShell>
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      </CatalogPageShell>
    )
  }
  if (isLoading) {
    return (
      <CatalogPageShell>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </CatalogPageShell>
    )
  }
  return <CatalogPageShell style={style}>{children()}</CatalogPageShell>
}

/**
 * The item's kind, name and meta line. With `onPlay`, a "Tocar" button; `actions` sit beside it,
 * like a playlist's "Editar".
 */
export function CatalogHeader({
  kindLabel,
  title,
  titleMark,
  cover,
  subtitle,
  meta,
  onPlay,
  isPlayDisabled = false,
  actions,
}: {
  kindLabel: string
  title: string
  /** Drawn before the name, like a genre's color. */
  titleMark?: React.ReactNode
  /** Drawn beside the text, like an album's cover. */
  cover?: React.ReactNode
  subtitle?: React.ReactNode
  meta: string
  onPlay?: () => void
  isPlayDisabled?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className={cover ? "flex flex-col gap-6 sm:flex-row sm:items-end" : undefined}>
      {cover}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-muted-foreground">{kindLabel}</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl leading-[1.05] font-medium tracking-[-0.03em] break-words sm:text-4xl">
          {titleMark}
          {title}
        </h1>
        {subtitle}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-xs text-muted-foreground tabular-nums">{meta}</p>
          {(onPlay || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {onPlay && (
                <Button size="lg" className="gap-2" disabled={isPlayDisabled} onClick={onPlay}>
                  <PlayIcon size={16} /> Tocar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** What a row's actions may use: the list's announcement and playing the row's track. */
export interface TrackActionContext {
  announce: (message: string, ok: boolean) => void
  play: () => void
}

/** The actions every track row has: queue, comments, like, dislike and add to a playlist. */
export function DefaultTrackActions({ track, announce, play }: { track: Track } & TrackActionContext) {
  return (
    <>
      <AddToQueueButton track={track} onResult={announce} />
      <TrackCommentsButton track={track} onPlay={play} />
      <TrackLikeButton trackId={track.id} />
      <TrackDislikeButton trackId={track.id} />
      <AddToPlaylistMenu musicId={Number(track.id)} title={track.title} onResult={announce} />
    </>
  )
}

function matchesSearch(track: Track, query: string): boolean {
  return [track.title, track.artist, track.album].some((text) => text.toLowerCase().includes(query))
}

/**
 * The item's tracks. A click plays them from that track (`onPlay` gets its index in `tracks`).
 * What "Adicionar à fila" or "Adicionar à playlist" did is announced above the list, to screen
 * readers too. With `searchLabel`, a field filters the list by title, artist or album; with
 * `onReorder`, the rows are dragged to a new order, except while searching.
 */
export function CatalogTrackList({
  tracks,
  onPlay,
  playingTrackId,
  isNumbered = false,
  isAlbumShown = false,
  searchLabel,
  onReorder,
  renderActions = (track, context) => <DefaultTrackActions track={track} {...context} />,
  emptyMessage,
  className,
}: {
  tracks: Track[]
  onPlay: (index: number) => void
  /** The track shown as playing; by default, the one playing now, wherever it was started. */
  playingTrackId?: string | null
  isNumbered?: boolean
  /** Adds the album to each row's meta, for lists that mix albums. */
  isAlbumShown?: boolean
  /** "Buscar no álbum": the label and placeholder of the search field. */
  searchLabel?: string
  onReorder?: (trackIds: string[]) => void
  renderActions?: (track: Track, context: TrackActionContext) => React.ReactNode
  /** Shown instead of an empty list; without it, nothing is shown. */
  emptyMessage?: React.ReactNode
  className?: string
}) {
  const playback = usePlayback()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [announcement, setAnnouncement] = React.useState<{ message: string; ok: boolean } | null>(null)
  const announce = React.useCallback((message: string, ok: boolean) => setAnnouncement({ message, ok }), [])

  if (tracks.length === 0) {
    return emptyMessage ? <p className={`text-sm text-muted-foreground ${className ?? ""}`}>{emptyMessage}</p> : null
  }

  const shownPlayingTrackId =
    playingTrackId !== undefined ? playingTrackId : playback?.isPlaying ? (currentTrackOf(playback)?.id ?? null) : null
  const query = searchQuery.trim().toLowerCase()
  const shownTracks = query ? tracks.filter((track) => matchesSearch(track, query)) : tracks
  const List = isNumbered ? "ol" : "ul"

  const renderRow = (track: Track) => {
    const index = tracks.indexOf(track)
    const play = () => onPlay(index)
    const text = (
      <span className="block min-w-0">
        <TrackTitle title={track.title} musicId={Number(track.id)} />
        <span className="block truncate text-xs text-muted-foreground">
          {[track.artist, isAlbumShown && track.album, track.duration].filter(Boolean).join(" · ")}
        </span>
      </span>
    )
    return (
      <TrackRow
        musicId={Number(track.id)}
        isPlaying={track.id === shownPlayingTrackId}
        onClick={play}
        title={track.title}
        actions={renderActions(track, { announce, play })}
      >
        {isNumbered ? (
          <span className="flex items-center gap-3">
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}</span>
            {text}
          </span>
        ) : (
          text
        )}
      </TrackRow>
    )
  }

  return (
    <div className={className}>
      {searchLabel && (
        <div className="relative mb-3 w-full max-w-64">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="h-8 bg-surface pl-8 text-sm"
          />
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
      {/* Always rendered, so the live region exists before the first message */}
      <output
        className={
          announcement
            ? `mb-3 block text-sm ${announcement.ok ? "text-muted-foreground" : "text-destructive"}`
            : "sr-only"
        }
      >
        {announcement?.message}
      </output>
      {shownTracks.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">Nenhuma faixa com “{searchQuery.trim()}”</p>
      ) : onReorder ? (
        // Off while searching, since only part of the list shows
        <SortableList
          ids={shownTracks.map((track) => track.id)}
          rowHeight={SORTABLE_ROW_HEIGHT}
          gap={4}
          disabled={Boolean(query)}
          onReorder={onReorder}
        >
          {shownTracks.map((track) => (
            <div key={track.id} className="flex h-full items-center">
              <div className="w-full">{renderRow(track)}</div>
            </div>
          ))}
        </SortableList>
      ) : (
        <List className="space-y-1">
          {shownTracks.map((track) => (
            <li key={track.id}>{renderRow(track)}</li>
          ))}
        </List>
      )}
    </div>
  )
}
