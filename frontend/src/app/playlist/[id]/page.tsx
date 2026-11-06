"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Header from "@/components/header"
import { ColorPicker, getContrastTextColor, getPlaylistAccentStyle } from "@/components/color-picker"
import { RecordSleeve } from "@/components/record-sleeve"
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
import { apiErrorMessage } from "@/lib/api/client"
import {
  parsePlaylistId,
  useRemovePlaylistMusic,
  useReorderPlaylistMusics,
  useUpdatePlaylist,
} from "@/lib/api/playlists"
import { PlaylistPrivacyField } from "@/components/playlist-privacy-field"
import { Label } from "@/components/ui/label"
import {
  getPlaylistInitials,
  MAX_PLAYLIST_NAME_LENGTH,
  type PlaylistDraft,
  playlistChanges,
  usePlaylistData,
} from "@/lib/playlist-store"
import { useSession } from "@/lib/auth/client"
import type { UserProfile } from "@/lib/comments-store"
import { TrackComments } from "@/components/comments/track-comments"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { SortableList } from "@/components/sortable-list"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { LevelBars } from "@/components/playback-marks"
import { currentTrackOf, isPlayingFrom, playPlaylist, togglePlayback, usePlayback } from "@/lib/playback-store"
import {
  ArrowLeftIcon,
  HeartIcon,
  ListMinusIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SearchIcon,
} from "@/components/icons"

const DEFAULT_PANEL_HEIGHT = 540
const MIN_PANEL_HEIGHT = 260

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

  // The playlist and its musics, in the playlist's order, from the API
  const { data: currentPlaylist, isPending, error, tracksError } = usePlaylistData(playlistId)
  const updatePlaylist = useUpdatePlaylist()
  const reorderTracks = useReorderPlaylistMusics()
  const removeTrack = useRemovePlaylistMusic()

  // The playlist being edited (name, visibility, color); null while the dialog is closed. Its
  // color is previewed on the page; nothing is saved until "Salvar"
  const [draft, setDraft] = React.useState<PlaylistDraft | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  // What the last "Adicionar à fila" did, announced to screen readers too
  const [queued, setQueued] = React.useState<string | null>(null)

  // Playback is shared by every page (see playback-store); this page shows it when it comes
  // from this playlist, and starts this playlist when one of its tracks is played
  const playback = usePlayback()
  const isThisPlaylist = isPlayingFrom(playback, playlistId ?? "")

  const openEditor = () => {
    if (!currentPlaylist) return
    updatePlaylist.reset()
    setDraft({ name: currentPlaylist.name, isPrivate: currentPlaylist.isPrivate, color: currentPlaylist.color })
  }

  // Closing without saving drops the draft, color preview included
  const closeEditor = () => setDraft(null)

  // One PATCH with only what changed; on failure the dialog stays open with the reason
  const saveEditor = (e: React.FormEvent) => {
    e.preventDefault()
    const id = parsePlaylistId(playlistId)
    if (!currentPlaylist || !draft || id === null) return
    const changes = playlistChanges(
      { name: currentPlaylist.name, isPrivate: currentPlaylist.isPrivate, color: currentPlaylist.color },
      draft
    )
    if (!changes) {
      if (draft.name.trim()) closeEditor()
      return
    }
    updatePlaylist.mutate({ id, input: changes }, { onSuccess: closeEditor })
  }

  // Takes a track out of the playlist (admins only); the list refreshes from the API
  const handleRemoveTrack = (trackId: string) => {
    const id = parsePlaylistId(playlistId)
    if (id !== null) removeTrack.mutate({ id, musicId: Number(trackId) })
  }

  // Reorder tracks (drag in the tracklist): saved for everyone who sees the playlist. The list
  // moves at once and goes back if the API refuses; playback follows the track id, so the playing
  // track stays the same one
  const handleReorderTracks = (ids: string[]) => {
    const id = parsePlaylistId(playlistId)
    if (id !== null) reorderTracks.mutate({ id, musicIds: ids.map(Number) })
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

  if (isPending) {
    return (
      <div className="flex-1 bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 pt-24 px-6 flex items-center justify-center">
          <p className="font-mono text-xs text-muted-foreground">Carregando playlist…</p>
        </main>
      </div>
    )
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
            {error ?? "Ela pode ter sido removida, ser privada ou o link está incorreto"}
          </p>
          <Link href="/playlist" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
            <ArrowLeftIcon size={16} /> Voltar às playlists
          </Link>
        </main>
      </div>
    )
  }

  const tracks = currentPlaylist.tracks
  const color = draft?.color ?? currentPlaylist.color
  // The current track of this playlist is marked even while paused, so the list shows where
  // playback stands
  const currentTrackId = isThisPlaylist ? currentTrackOf(playback)?.id : undefined
  const currentTrackIndex = currentTrackId ? tracks.findIndex((track) => track.id === currentTrackId) : -1
  const isPlaying = isThisPlaylist && Boolean(playback?.isPlaying)
  const playAt = (index: number, playing = true) => {
    if (tracks[index]) playPlaylist(currentPlaylist, index, playing)
  }
  const playlistAccent = getPlaylistAccentStyle(color)
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
              <span>Playlists</span>
            </Link>

            {/* Only a playlist admin can edit it; the API refuses anyone else */}
            {currentPlaylist.canEdit && (
              <Button variant="outline" size="lg" onClick={openEditor} className="gap-2">
                <PencilIcon size={16} className="text-muted-foreground" />
                Editar playlist
              </Button>
            )}
          </div>

          {/* Sleeve and title, aligned on their bottom edge like an album page */}
          <section className="flex flex-col gap-8 pt-8 pb-12 md:flex-row md:items-end md:gap-10">
            <RecordSleeve
              color={color}
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
              {tracks.length > 0 && (
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  {tracks.length} {tracks.length === 1 ? "faixa" : "faixas"} · {totalDuration}
                </p>
              )}
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

            {/* Always rendered, so the live region exists before the first message */}
            <output className={queued ? "block py-2 text-xs text-muted-foreground" : "sr-only"}>{queued}</output>
            {reorderTracks.isError && (
              <p role="alert" className="py-2 text-xs text-destructive">
                Não deu para salvar a nova ordem. {apiErrorMessage(reorderTracks.error)}
              </p>
            )}
            {removeTrack.isError && (
              <p role="alert" className="py-2 text-xs text-destructive">
                Não deu para tirar a faixa. {apiErrorMessage(removeTrack.error)}
              </p>
            )}

            {/* Drag to reorder (playlist admins only); off while searching, since only part of the list shows */}
            {tracksError ? (
              <p role="alert" className="py-12 text-center text-xs text-destructive">
                Não deu para carregar as faixas. {tracksError}
              </p>
            ) : tracks.length === 0 ? (
              // An empty playlist: admins get the way to fill it, everyone else just an empty list
              currentPlaylist.canEdit && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Busque uma música e use{" "}
                  <Link href="/busca" className="text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground">
                    Adicionar à playlist
                  </Link>
                </p>
              )
            ) : filteredTracks.length === 0 ? (
              <p className="py-12 text-center font-mono text-xs text-muted-foreground">
                Nenhuma faixa com “{searchQuery.trim()}”
              </p>
            ) : (
              <SortableList
                ids={filteredTracks.map((t) => t.id)}
                rowHeight={56}
                gap={2}
                disabled={isSearching || !currentPlaylist.canEdit}
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
                        !isSearching && currentPlaylist.canEdit && "active:cursor-grabbing",
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
                          {[track.artist, [track.album, track.year].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </div>
                      </div>

                      <div className="pointer-events-none relative flex shrink-0 items-center gap-3">
                        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {track.duration}
                        </span>

                        {/* Content is click-through to the row; this button opts back in */}
                        <span className="pointer-events-auto">
                          <AddToQueueButton track={track} onResult={setQueued} />
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

                        {currentPlaylist.canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTrack(track.id)}
                            disabled={removeTrack.isPending && removeTrack.variables?.musicId === Number(track.id)}
                            aria-label={`Tirar ${track.title} da playlist`}
                            title="Tirar da playlist"
                            // Shown on the row's hover or focus, like delete on the shelf; always on touch screens
                            className="pointer-events-auto flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[color,opacity] duration-150 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 disabled:opacity-40 [@media(hover:none)]:opacity-100"
                          >
                            <ListMinusIcon size={16} />
                          </button>
                        )}
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
                  if (currentTrackId === commentTrack.id && playback?.isPlaying) {
                    togglePlayback()
                  } else {
                    playAt(tracks.indexOf(commentTrack))
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-border bg-background hover:bg-surface text-xs font-medium cursor-pointer transition-colors"
              >
                {currentTrackId === commentTrack.id && playback?.isPlaying ? (
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
                playAt(tracks.indexOf(commentTrack))
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

      <Dialog open={draft !== null} onOpenChange={(open) => (open ? openEditor() : closeEditor())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar playlist</DialogTitle>
            <DialogDescription>A cor vale para o encarte, o disco e os destaques desta página</DialogDescription>
          </DialogHeader>

          {draft && (
            <form onSubmit={saveEditor} className="space-y-5 pt-1">
              <div className="space-y-2">
                <Label htmlFor="edit-playlist-name" className="text-sm font-medium">
                  Nome
                </Label>
                <Input
                  id="edit-playlist-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  maxLength={MAX_PLAYLIST_NAME_LENGTH}
                  required
                />
              </div>

              <ColorPicker color={draft.color} onChange={(next) => setDraft({ ...draft, color: next })} />

              <PlaylistPrivacyField isPrivate={draft.isPrivate} onChange={(next) => setDraft({ ...draft, isPrivate: next })} />

              {updatePlaylist.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(updatePlaylist.error)}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="lg" onClick={closeEditor}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={!draft.name.trim() || updatePlaylist.isPending}>
                  {updatePlaylist.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
