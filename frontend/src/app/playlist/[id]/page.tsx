"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Header from "@/components/header"
import { ColorPicker, getContrastTextColor, getPlaylistAccentStyle } from "@/components/color-picker"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  getPlaylistInitials,
  useStoredPlaylists,
} from "@/lib/playlist-store"
import { useSession } from "@/lib/auth/client"
import type { UserProfile } from "@/lib/comments-store"
import { TrackComments } from "@/components/comments/track-comments"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"
import { SortableList } from "@/components/sortable-list"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { LevelBars, Record } from "@/components/playback-marks"
import { isPlayingFrom, playPlaylist, togglePlayback, usePlayback } from "@/lib/playback-store"
import {
  ArrowLeftIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
} from "@/components/icons"

const DEFAULT_PANEL_HEIGHT = 540
const MIN_PANEL_HEIGHT = 260

// The playlist cover as a record sleeve in the playlist color, with the record half out of it.
// While this playlist plays, the record slides a little further out and turns
function RecordSleeve({ color, initials, playing }: { color: string; initials: string; playing: boolean }) {
  const contrastText = getContrastTextColor(color)

  return (
    <div className="relative h-48 w-64 shrink-0 md:h-52 md:w-72">
      {/* Record */}
      <div
        className={cn(
          "absolute top-2 left-0 size-44 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:size-48",
          playing ? "translate-x-20" : "translate-x-14"
        )}
      >
        <Record
          color={color}
          playing={playing}
          className="size-full shadow-[0_8px_20px_-10px_rgba(23,21,18,0.6)]"
        />
      </div>

      {/* Sleeve */}
      <div
        className={cn(
          "relative z-10 flex size-48 items-center justify-center rounded-md md:size-52",
          "shadow-[0_1px_2px_rgba(23,21,18,0.12),0_16px_32px_-16px_rgba(23,21,18,0.45)]",
          contrastText
        )}
        style={{ backgroundColor: color }}
      >
        {/* Printed frame, like the rule around a sleeve's artwork */}
        <div className="pointer-events-none absolute inset-3 rounded-sm border border-current opacity-25" />
        <span className="select-none text-6xl font-medium tracking-[-0.03em]">{initials}</span>
      </div>
    </div>
  )
}

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>()
  const playlistId = params?.id

  // Active user profile from Better Auth session
  const { data: session } = useSession()
  const currentUser: UserProfile | null = React.useMemo(() => {
    if (!session?.user) return null
    return {
      id: Number(session.user.id),
      name: session.user.name,
      birthdate: session.user.birthdate,
      isUnderage: !session.user.isAdult,
    }
  }, [session])

  const currentUserId = currentUser?.id ?? 0

  // Liked tracks state for the current user
  const { isLiked: isTrackLiked, toggleLike } = useLikedTracks(currentUserId)

  // All playlists in memory / localStorage with hydration safety
  const { playlists, persistPlaylists } = useStoredPlaylists()

  const [isColorModalOpen, setIsColorModalOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Playback is shared by every page (see playback-store); this page shows it when it comes
  // from this playlist, and starts this playlist when one of its tracks is played
  const playback = usePlayback()
  const isThisPlaylist = isPlayingFrom(playback, playlistId ?? "")

  const currentPlaylist = playlists.find((p) => p.id === playlistId) ?? null

  const handleUpdateColor = (newColor: string) => {
    if (!currentPlaylist) return
    const updated = playlists.map((p) =>
      p.id === currentPlaylist.id ? { ...p, color: newColor } : p
    )
    persistPlaylists(updated)
  }

  // Reorder tracks (drag in the tracklist); playback follows the track id, so the playing
  // track stays the same one
  const handleReorderTracks = (ids: string[]) => {
    if (!currentPlaylist) return
    const reordered = ids
      .map((id) => currentPlaylist.tracks.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
    persistPlaylists(playlists.map((p) => (p.id === currentPlaylist.id ? { ...p, tracks: reordered } : p)))
  }

  // Selected track for comments
  const [commentTrackId, setCommentTrackId] = React.useState<string | null>(null)
  const [isCommentsExpanded, setIsCommentsExpanded] = React.useState(false)

  // Derivação segura: menores de idade nunca têm comentários abertos
  const isCommentsOpen = Boolean(isCommentsExpanded && currentUser && !currentUser.isUnderage)

  // Fecha os comentários ao pressionar Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCommentsOpen) {
        setIsCommentsExpanded(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isCommentsOpen])

  // Drag and resize handlers for comments drawer
  const [panelHeight, setPanelHeight] = React.useState(DEFAULT_PANEL_HEIGHT)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef<{ startY: number; startHeight: number } | null>(null)

  const handleResizeStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startHeight: panelHeight }
    setIsDragging(true)
  }

  const handleResizeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const next = drag.startHeight + (drag.startY - e.clientY) // arrastar p/ cima aumenta
    const max = Math.round(window.innerHeight * 0.85)
    setPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(max, next)))
  }

  const handleResizeEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (panelHeight < MIN_PANEL_HEIGHT) {
      setIsCommentsExpanded(false)
      setPanelHeight(DEFAULT_PANEL_HEIGHT)
    }
  }

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp") {
      setPanelHeight((h) => Math.min(Math.round(window.innerHeight * 0.85), h + 40))
    } else if (e.key === "ArrowDown") {
      setPanelHeight((h) => {
        const next = h - 40
        if (next < MIN_PANEL_HEIGHT) {
          setIsCommentsExpanded(false)
          return DEFAULT_PANEL_HEIGHT
        }
        return next
      })
    } else if (e.key === "Escape") {
      setIsCommentsExpanded(false)
    }
  }

  if (!currentPlaylist) {
    return (
      <div className="flex-1 bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 pt-24 px-6 flex flex-col items-center justify-center text-center">
          {/* An empty sleeve: just its printed frame */}
          <div className="mb-6 size-20 rounded-md border border-dashed border-border" aria-hidden="true" />
          <h1 className="text-2xl font-medium mb-2">Playlist não encontrada</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Ela pode ter sido removida ou o link está incorreto
          </p>
          <Link href="/playlist" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
            <ArrowLeftIcon size={16} /> Voltar ao catálogo
          </Link>
        </main>
      </div>
    )
  }

  const tracks = currentPlaylist.tracks
  // The current track of this playlist is marked even while paused, so the list shows where
  // playback stands
  const currentTrackIndex = isThisPlaylist
    ? tracks.findIndex((t) => t.id === playback?.currentTrackId)
    : -1
  const isPlaying = isThisPlaylist && Boolean(playback?.isPlaying)
  const playAt = (index: number, playing = true) => {
    const track = tracks[index]
    if (track) playPlaylist(currentPlaylist.id, track.id, playing)
  }
  const playlistAccent = getPlaylistAccentStyle(currentPlaylist.color)
  const totalDuration = formatTotalDuration(sumDurationSec(tracks))
  const isSearching = searchQuery.trim() !== ""

  const commentTrack =
    (commentTrackId ? tracks.find((t) => t.id === commentTrackId) : null) ??
    (currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null) ??
    tracks[0] ??
    null

  const filteredTracks = tracks.filter((track) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.album.toLowerCase().includes(query)
    )
  })

  return (
    <div
      className="flex-1 bg-background text-foreground flex flex-col font-sans"
      style={playlistAccent}
    >
      <Header />

      <main className="flex-1 pt-16 flex flex-col">
        <div className="max-w-6xl mx-auto w-full px-6 md:px-8 pt-8 pb-16 flex-1 flex flex-col">
          {/* Back and the one setting this page has */}
          <div className="flex h-8 items-center justify-between">
            <Link
              href="/playlist"
              className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ArrowLeftIcon size={16} />
              <span>Catálogo</span>
            </Link>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsColorModalOpen(true)}
              className="gap-2"
            >
              <span
                className="size-3 rounded-full ring-1 ring-ink/15"
                style={{ backgroundColor: currentPlaylist.color }}
              />
              Alterar cor
            </Button>
          </div>

          {/* Sleeve and title, aligned on their bottom edge like an album page */}
          <section className="flex flex-col gap-8 pt-8 pb-12 md:flex-row md:items-end md:gap-10">
            <RecordSleeve
              color={currentPlaylist.color}
              initials={getPlaylistInitials(currentPlaylist.name)}
              playing={isPlaying}
            />

            <div className="min-w-0 flex-1 md:pb-2">
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                Playlist {currentPlaylist.isPrivate ? "privada" : "pública"}
              </p>
              <h1 className="mb-4 break-words text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl md:text-6xl">
                {currentPlaylist.name}
              </h1>
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {tracks.length} {tracks.length === 1 ? "faixa" : "faixas"} · {totalDuration}
              </p>
            </div>
          </section>

          {/* Tracklist, set like the back of a record */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-4 border-b border-ink/10 pb-3">
              {/* Same 32px box as the search field, so the label sits on its middle */}
              <h2 className="flex h-8 items-center text-sm font-medium">Faixas</h2>
              <div className="relative w-full max-w-64">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar na playlist"
                  aria-label="Buscar na playlist"
                  className="h-8 bg-surface pl-8 text-sm"
                />
                <SearchIcon
                  size={16}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>

            {/* Drag to reorder; off while searching, since only part of the list shows */}
            {filteredTracks.length === 0 ? (
              <p className="py-12 text-center font-mono text-xs text-muted-foreground">
                Nenhuma faixa com “{searchQuery.trim()}”
              </p>
            ) : (
              <SortableList
                ids={filteredTracks.map((t) => t.id)}
                rowHeight={56}
                gap={2}
                disabled={isSearching}
                onReorder={handleReorderTracks}
              >
                {filteredTracks.map((track) => {
                  const actualIdx = tracks.findIndex((t) => t.id === track.id)
                  const isCurrent = currentTrackIndex === actualIdx
                  const isTrackPlaying = isCurrent && isPlaying
                  const isLiked = isTrackLiked(track.id)

                  // Clicking the playing track pauses it; any other click plays the clicked track
                  const playOrPauseRow = () => {
                    if (isTrackPlaying) togglePlayback()
                    else playAt(actualIdx)
                  }

                  return (
                    <div
                      key={track.id}
                      className={cn(
                        // Pointer: a click plays the track; grabbing only while a drag is held
                        "group relative flex h-full cursor-pointer select-none items-center gap-4 rounded-lg px-3 transition-colors duration-150",
                        !isSearching && "active:cursor-grabbing",
                        isCurrent ? "bg-surface" : "hover:bg-ink/[0.04]"
                      )}
                    >
                      {/* Row-wide play button */}
                      <button
                        type="button"
                        data-row-action
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={playOrPauseRow}
                        className="absolute inset-0 rounded-lg cursor-[inherit]"
                      />

                      {/* The current track carries a thin rule in the accent on its left edge */}
                      {isCurrent && (
                        <span className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" />
                      )}

                      {/* Number, or the play state: level bars while playing, pause on hover */}
                      <div className="pointer-events-none relative flex w-6 shrink-0 justify-end font-mono text-xs tabular-nums text-muted-foreground">
                        {isTrackPlaying ? (
                          <>
                            <span className="text-primary group-hover:hidden"><LevelBars playing /></span>
                            <PauseIcon size={16} className="hidden text-foreground group-hover:block" />
                          </>
                        ) : (
                          <>
                            <span className={cn("group-hover:hidden", isCurrent && "text-primary")}>
                              {String(actualIdx + 1).padStart(2, "0")}
                            </span>
                            <PlayIcon size={16} className="hidden text-foreground group-hover:block" />
                          </>
                        )}
                      </div>

                      {/* Content lets clicks fall through to the row button; its own buttons opt back in */}
                      <div className="pointer-events-none relative min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={playOrPauseRow}
                          aria-label={isTrackPlaying ? `Pausar ${track.title}` : `Tocar ${track.title}`}
                          className={cn(
                            "pointer-events-auto block max-w-full truncate rounded-sm text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
                            isCurrent ? "text-primary" : "text-foreground"
                          )}
                        >
                          {track.title}
                        </button>
                        <div className="truncate text-xs text-muted-foreground">
                          {track.artist} · {track.album}, {track.year}
                        </div>
                      </div>

                      <div className="pointer-events-none relative flex shrink-0 items-center gap-3">
                        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {track.duration}
                        </span>

                        {/* Comentários: visível para maiores de 18 */}
                        {currentUser && !currentUser.isUnderage && (
                          <button
                            type="button"
                            onClick={() => {
                              setCommentTrackId(track.id)
                              setIsCommentsExpanded(true)
                            }}
                            aria-label={`Comentários de ${track.title}`}
                            className={cn(
                              "pointer-events-auto flex size-8 items-center justify-center rounded-md border transition-all text-xs cursor-pointer",
                              isCommentsExpanded && commentTrack?.id === track.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                            )}
                            title="Comentários desta faixa"
                          >
                            💬
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleLike(track.id)}
                          aria-label={isLiked ? "Descurtir faixa" : "Curtir faixa"}
                          aria-pressed={isLiked}
                          className={cn(
                            "pointer-events-auto flex size-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2",
                            isLiked
                              ? "text-primary"
                              : "text-muted-foreground/50 hover:text-foreground"
                          )}
                        >
                          <HeartIcon size={16} className={cn(isLiked && "[&_svg]:fill-current")} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </SortableList>
            )}
          </section>
        </div>
      </main>

      {/* =========================================================================
          SLIDE-UP COMMENTS PANEL (ADULT ONLY)
          ========================================================================= */}
      {isCommentsOpen && commentTrack && currentUser && (
        <div
          className={cn(
            "fixed bottom-0 inset-x-0 bg-surface/98 backdrop-blur-md border-t-2 border-primary/30 z-50 shadow-2xl ease-in-out flex flex-col overflow-hidden rounded-t-2xl",
            !isDragging && "transition-all duration-300"
          )}
          style={{ height: `min(${panelHeight}px, 85vh)` }}
        >
          {/* Resize handle */}
          <button
            type="button"
            aria-label="Redimensionar painel de comentários"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onKeyDown={handleResizeKeyDown}
            className="group w-full h-5 shrink-0 flex items-center justify-center cursor-row-resize touch-none select-none focus-visible:outline-none"
          >
            <div className="w-12 h-1 rounded-full bg-border group-hover:bg-muted-foreground/60 group-focus-visible:bg-primary transition-colors" />
          </button>

          {/* Header */}
          <div className="h-14 px-6 flex items-center justify-between shrink-0 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="size-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0 border border-black/10 shadow-2xs"
                style={{ backgroundColor: currentPlaylist.color }}
              >
                <span className={cn(getContrastTextColor(currentPlaylist.color))}>
                  {getPlaylistInitials(currentPlaylist.name)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-foreground truncate">
                  Comentários: {commentTrack.title}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {commentTrack.artist} · {commentTrack.duration}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isThisPlaylist && playback?.currentTrackId === commentTrack.id && playback?.isPlaying) {
                    togglePlayback()
                  } else {
                    playPlaylist(currentPlaylist.id, commentTrack.id)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-border bg-background hover:bg-surface text-xs font-medium cursor-pointer transition-colors"
              >
                {isThisPlaylist && playback?.currentTrackId === commentTrack.id && playback?.isPlaying ? (
                  <>
                    <PauseIcon size={14} />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <PlayIcon size={14} />
                    <span>Tocar</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsCommentsExpanded(false)}
                className="size-8 rounded-md border border-border bg-background hover:bg-surface text-foreground flex items-center justify-center text-xs cursor-pointer transition-colors"
                aria-label="Fechar painel de comentários"
                title="Fechar comentários"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Track comments list and form */}
          <div className="flex-1 overflow-y-auto">
            <TrackComments
              key={commentTrack.id}
              track={commentTrack}
              user={currentUser}
              currentPlaybackSec={0}
              onSeek={() => {
                playPlaylist(currentPlaylist.id, commentTrack.id)
              }}
            />
          </div>
        </div>
      )}

      {/* Backdrop ao expandir comentários */}
      {isCommentsOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-300"
          onClick={() => setIsCommentsExpanded(false)}
          aria-hidden="true"
        />
      )}

      <Dialog open={isColorModalOpen} onOpenChange={setIsColorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cor da playlist</DialogTitle>
            <DialogDescription>
              A cor vale para o encarte, o disco e os destaques desta página
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <ColorPicker
              color={currentPlaylist.color}
              onChange={handleUpdateColor}
            />

            <DialogFooter className="pt-2">
              <Button type="button" size="lg" onClick={() => setIsColorModalOpen(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
