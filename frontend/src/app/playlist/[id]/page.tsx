"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Header from "@/components/header"
import { ColorPicker, getContrastTextColor } from "@/components/color-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"
import { useLikedTracks } from "@/lib/likes-store"
import { SortableList } from "@/components/sortable-list"
import {
  ArrowLeftIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
} from "@/components/icons"

const PLAYER_BAR_HEIGHT = 80       // h-20
const DEFAULT_PANEL_HEIGHT = 540
const MIN_PANEL_HEIGHT = 260       // soltar abaixo disso fecha os comentários

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

  // Modal State for Editing Color
  const [isColorModalOpen, setIsColorModalOpen] = React.useState(false)

  // Expandable Comments Panel State (faz subir a parte de música)
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

  // Track search filter
  const [searchQuery, setSearchQuery] = React.useState("")

  // Audio Playback state
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = React.useState(0)
  const [playbackSec, setPlaybackSec] = React.useState(0)
  const [volume, setVolume] = React.useState(70) // percentage 0-100
  const [isMuted, setIsMuted] = React.useState(false)

  // Find the playlist
  const currentPlaylist = playlists.find((p) => p.id === playlistId) ?? null

  // Update Color handler
  const handleUpdateColor = (newColor: string) => {
    if (!currentPlaylist) return
    const updated = playlists.map((p) =>
      p.id === currentPlaylist.id ? { ...p, color: newColor } : p
    )
    persistPlaylists(updated)
  }

  // Reorder tracks (drag in the tracklist); the playing track stays the same one
  const handleReorderTracks = (ids: string[]) => {
    if (!currentPlaylist) return
    const playingId = currentPlaylist.tracks[currentTrackIndex]?.id
    const reordered = ids
      .map((id) => currentPlaylist.tracks.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
    persistPlaylists(playlists.map((p) => (p.id === currentPlaylist.id ? { ...p, tracks: reordered } : p)))
    setCurrentTrackIndex(Math.max(0, reordered.findIndex((t) => t.id === playingId)))
  }

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
    setPanelHeight(Math.max(PLAYER_BAR_HEIGHT, Math.min(max, next)))
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
      e.preventDefault()
      setPanelHeight((h) => Math.min(Math.round(window.innerHeight * 0.85), h + 24))
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setPanelHeight((h) => Math.max(MIN_PANEL_HEIGHT, h - 24))
    }
  }

  // If playlist not found
  if (!currentPlaylist) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 pt-24 px-6 flex flex-col items-center justify-center text-center">
          <div className="size-16 rounded-2xl border border-border bg-surface flex items-center justify-center text-2xl mb-4 font-mono shadow-xs">
            ∅
          </div>
          <h1 className="text-2xl font-bold mb-2">Playlist não encontrada</h1>
          <p className="text-sm text-muted-foreground mb-6 font-light max-w-sm">
            Esta playlist não foi encontrada ou pode ter sido removida.
          </p>
          <Link href="/playlist">
            <Button variant="default" className="text-xs font-semibold cursor-pointer gap-1.5">
              <ArrowLeftIcon size={14} /> Voltar ao Catálogo
            </Button>
          </Link>
        </main>
      </div>
    )
  }

  const tracks = currentPlaylist.tracks
  const contrastText = getContrastTextColor(currentPlaylist.color)
  // The playlist color becomes this page's accent: primary, focus ring and text selection
  // (selection:bg-primary/20 below) all follow it. Light colors get a darker variant so
  // accent text and icons stay readable on the paper background.
  const isLightColor = contrastText === "text-black"
  const playlistAccent = {
    "--primary": isLightColor
      ? `color-mix(in oklab, ${currentPlaylist.color} 70%, black)`
      : currentPlaylist.color,
    // Dark colors already carry light text; light ones are darkened above, so light text fits both
    "--primary-foreground": "var(--color-paper-bright)",
    "--ring": currentPlaylist.color,
  } as React.CSSProperties
  const totalDurationMin = Math.round(
    tracks.reduce((acc, t) => acc + t.durationSec, 0) / 60
  )

  // Filtered tracks by search query only
  const filteredTracks = tracks.filter((track) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.album.toLowerCase().includes(query)
    )
  })

  const currentPlayingTrack = tracks[currentTrackIndex]

  const currentDurationSec = currentPlayingTrack?.durationSec || 240
  const currentElapsedSec = Math.min(playbackSec, currentDurationSec)
  const playbackProgress = (currentElapsedSec / currentDurationSec) * 100
  const elapsedMin = Math.floor(currentElapsedSec / 60)
  const elapsedSecFormatted = (currentElapsedSec % 60).toString().padStart(2, "0")

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground relative"
      style={playlistAccent}
    >
      <Header />

      <main className="flex-1 pt-16 flex flex-col relative overflow-hidden">
        {/*
          FULL-WIDTH DYNAMIC COLOR WASH ACROSS THE ENTIRE SCREEN:
          Extends across 100% of the viewport width, bathing the entire page header smoothly.
        */}
        <div
          className="absolute inset-x-0 top-0 w-full h-[540px] pointer-events-none transition-all duration-700 ease-out"
          style={{
            background: `linear-gradient(180deg, ${currentPlaylist.color}45 0%, ${currentPlaylist.color}15 360px, transparent 100%)`,
          }}
        />
        {/* Full-width ambient glow filling the whole viewport width symmetrically */}
        <div
          className="absolute inset-x-0 top-0 w-full h-[460px] pointer-events-none blur-3xl opacity-35 transition-all duration-700 ease-out"
          style={{
            background: `radial-gradient(ellipse 100% 70% at 50% 0%, ${currentPlaylist.color} 0%, transparent 100%)`,
          }}
        />

        <div className="max-w-6xl mx-auto w-full px-6 md:px-8 py-8 flex-1 flex flex-col relative z-10">
          {/* Navigation & Header Actions */}
          <div className="flex items-center justify-between pb-6">
            <Link
              href="/playlist"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
            >
              <ArrowLeftIcon size={14} />
              <span>Voltar ao Catálogo</span>
            </Link>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsColorModalOpen(true)}
                className="h-8 text-xs border-border bg-surface/80 hover:bg-surface gap-1.5 cursor-pointer shadow-2xs"
              >
                <span
                  className="size-3 rounded-full border border-black/20"
                  style={{ backgroundColor: currentPlaylist.color }}
                />
                Alterar Cor
              </Button>
            </div>
          </div>

          {/* =========================================================================
              HERO SECTION: VINYL OBJECT + DISPLAY TYPOGRAPHY
              ========================================================================= */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 pb-8">
            {/* Tactile Vinyl Sleeve */}
            <div className="relative shrink-0">
              {/* Front Jacket Card */}
              <div
                className="size-48 md:size-52 rounded-xl shadow-xl border border-black/10 p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-500"
                style={{
                  backgroundColor: currentPlaylist.color,
                  boxShadow: `0 16px 36px -12px ${currentPlaylist.color}66, 0 8px 16px -4px rgba(0,0,0,0.12)`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-white/20 pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-black/20", contrastText)}>
                    {currentPlaylist.isPrivate ? "PRIVADA" : "PÚBLICA"}
                  </span>
                </div>

                <div className="relative z-10 my-auto text-center">
                  <div className={cn("text-6xl font-black tracking-tighter drop-shadow-sm select-none", contrastText)}>
                    {getPlaylistInitials(currentPlaylist.name)}
                  </div>
                </div>
              </div>
            </div>

            {/* Title & Objective Metadata Only */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px] py-0 border-border">
                  {currentPlaylist.isPrivate ? "Privada" : "Pública"}
                </Badge>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-none mb-3 break-words">
                {currentPlaylist.name}
              </h1>

              {/* Objective specs only: track count and total duration */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span>{tracks.length} {tracks.length === 1 ? "faixa" : "faixas"}</span>
                <span>•</span>
                <span>{totalDurationMin} min total</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              TRACKLIST SECTION
              ========================================================================= */}
          <div className="pb-36 pt-6">
            {/* Search Bar without emoji */}
            <div className="flex items-center justify-end mb-6">
              <div className="relative w-full sm:w-72">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar faixa, artista..."
                  className="h-8 text-xs bg-surface pl-8"
                />
                <SearchIcon
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
            </div>

            {/* Tracklist Items (drag to reorder; off while searching, since only part of the list shows) */}
            {filteredTracks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs font-mono">
                Nenhuma faixa encontrada na busca.
              </div>
            ) : (
              <SortableList
                ids={filteredTracks.map((t) => t.id)}
                rowHeight={66}
                disabled={searchQuery.trim() !== ""}
                onReorder={handleReorderTracks}
              >
                {filteredTracks.map((track) => {
                  const actualIdx = tracks.findIndex((t) => t.id === track.id)
                  const isTrackActive = isPlaying && currentTrackIndex === actualIdx
                  const isLiked = isTrackLiked(track.id)

                  return (
                    <div
                      key={track.id}
                      className={cn(
                        // Pointer: a click plays the track; grabbing only while a drag is held
                        "group relative h-full rounded-xl border p-3.5 transition-colors flex items-center justify-between gap-4 select-none cursor-pointer",
                        !searchQuery.trim() && "active:cursor-grabbing",
                        isTrackActive
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/70 bg-surface/70 hover:bg-surface hover:border-border"
                      )}
                    >
                      {/* Row-wide play button: a click anywhere on the row plays the track. The
                          other buttons sit above it (relative z-10) and keep their own action;
                          data-row-action keeps the row draggable through it. */}
                      <button
                        type="button"
                        data-row-action
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={() => {
                          setCurrentTrackIndex(actualIdx)
                          setIsPlaying(true)
                        }}
                        className="absolute inset-0 rounded-xl cursor-[inherit]"
                      />
                      {/* Content lets clicks fall through to the row button; its own buttons opt back in */}
                      {/* Left: Track Number, Title & Artist */}
                      <div className="relative pointer-events-none flex items-center gap-3.5 min-w-0">
                        {/* Position Badge */}
                        <div
                          className={cn(
                            "size-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 border transition-colors",
                            isTrackActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border group-hover:text-foreground"
                          )}
                        >
                          {isTrackActive ? <PlayIcon size={12} /> : actualIdx + 1}
                        </div>

                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentTrackIndex(actualIdx)
                              setIsPlaying(true)
                            }}
                            className={cn(
                              "pointer-events-auto font-bold text-sm text-left truncate cursor-pointer hover:underline block",
                              isTrackActive ? "text-primary" : "text-foreground"
                            )}
                          >
                            {track.title}
                          </button>

                          <div className="text-xs text-muted-foreground truncate">
                            {track.artist} <span className="opacity-40">•</span> {track.album} ({track.year})
                          </div>
                        </div>
                      </div>

                      {/* Right: Inline Equalizer, Comments (Adults only), Duration & Actions */}
                      <div className="relative pointer-events-none flex items-center gap-3 shrink-0 font-mono text-xs">

                        {/* Inline Equalizer Animation when playing */}
                        {isTrackActive && (
                          <div className="flex items-end gap-0.5 h-3.5">
                            <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s] h-2.5" />
                            <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.1s] h-3.5" />
                            <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.2s] h-2" />
                            <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.4s] h-3" />
                          </div>
                        )}

                        <span className="text-muted-foreground font-mono">
                          {track.duration}
                        </span>

                        {/* Comentários: VISÍVEL APENAS PARA MAIORES DE 18 */}
                        {currentUser && !currentUser.isUnderage && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentTrackIndex(actualIdx)
                              setIsCommentsExpanded(true)
                            }}
                            aria-label={`Comentários de ${track.title}`}
                            className={cn(
                              "pointer-events-auto size-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer text-xs",
                              isCommentsExpanded && currentTrackIndex === actualIdx
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                            )}
                            title="Comentários desta faixa"
                          >
                            💬
                          </button>
                        )}

                        {/* Play / Pause button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isTrackActive) {
                              setIsPlaying(!isPlaying)
                            } else {
                              setCurrentTrackIndex(actualIdx)
                              setIsPlaying(true)
                            }
                          }}
                          className={cn(
                            "pointer-events-auto size-7 rounded-lg border border-border flex items-center justify-center transition-all cursor-pointer",
                            isTrackActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"
                          )}
                          aria-label={isTrackActive ? `Pausar ${track.title}` : `Tocar ${track.title}`}
                        >
                          {isTrackActive ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                        </button>

                        {/* Like bookmark */}
                        <button
                          type="button"
                          onClick={() => toggleLike(track.id)}
                          aria-label={isLiked ? "Descurtir faixa" : "Curtir faixa"}
                          className={cn(
                            "pointer-events-auto size-7 flex items-center justify-center transition-colors cursor-pointer",
                            isLiked ? "text-primary" : "text-muted-foreground/40 hover:text-foreground"
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
          </div>
        </div>

        {/* =========================================================================
            PERSISTENT BOTTOM AUDIO CONTROLLER + SLIDE-UP COMMENTS PANEL
            Quando o usuário clica em Comentários, a barra de música sobe suavemente
            e revela os comentários e o campo para comentar logo abaixo.
            ========================================================================= */}
        <div
          className={cn(
            "fixed bottom-0 inset-x-0 bg-surface/98 backdrop-blur-md border-t border-border z-50 shadow-2xl ease-in-out flex flex-col overflow-hidden",
            !isDragging && "transition-all duration-300",
            isCommentsOpen ? "rounded-t-2xl border-t-2 border-primary/30" : "h-20"
          )}
          style={isCommentsOpen ? { height: `min(${panelHeight}px, 85vh)` } : undefined}
        >
          {isCommentsOpen && (
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
          )}

          {/* Barra de Áudio / Controles (altura fixa h-20) */}
          <div className="h-20 min-h-[5rem] px-6 flex items-center justify-between shrink-0">
          {/* Left: Track Name & Mini Cover */}
          <div className="flex items-center gap-3 w-1/4 min-w-[140px]">
            <div
              className="size-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-black/10 shadow-2xs"
              style={{ backgroundColor: currentPlaylist.color }}
            >
              <span className={cn(contrastText)}>
                {getPlaylistInitials(currentPlaylist.name)}
              </span>
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="font-bold text-xs text-foreground truncate">
                {currentPlayingTrack?.title}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {currentPlayingTrack?.artist}
              </div>
            </div>
          </div>

          {/* Center: Playback Controls & Progress Scrubber */}
          <div className="flex flex-col items-center gap-1.5 flex-1 max-w-md px-2">
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setCurrentTrackIndex((prev) => (prev > 0 ? prev - 1 : tracks.length - 1))
                }}
                aria-label="Faixa anterior"
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <SkipBackIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? "Pausar reprodução" : "Iniciar reprodução"}
                className="size-8 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              >
                {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentTrackIndex((prev) => (prev < tracks.length - 1 ? prev + 1 : 0))
                }}
                aria-label="Próxima faixa"
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <SkipForwardIcon size={18} />
              </button>
            </div>

            {/* Dynamic Scrubber colored with the playlist color */}
            <div className="w-full flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span>{`${elapsedMin}:${elapsedSecFormatted}`}</span>
              <button
                type="button"
                onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                setPlaybackSec(Math.round(ratio * currentDurationSec))
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    setPlaybackSec((s) => Math.min(currentDurationSec, s + 5))
                  } else if (e.key === "ArrowLeft") {
                    setPlaybackSec((s) => Math.max(0, s - 5))
                  }
                }}
                aria-label="Avançar ou retroceder na reprodução"
                className="relative flex-1 h-3 flex items-center cursor-pointer group focus:outline-none"
              >
                <span className="w-full h-1.5 bg-border rounded-full overflow-hidden block">
                  <span
                    className="h-full rounded-full transition-all block"
                    style={{
                      width: `${playbackProgress}%`,
                      backgroundColor: currentPlaylist.color,
                    }}
                  />
                </span>
              </button>
              <span>{currentPlayingTrack?.duration || "0:00"}</span>
            </div>
          </div>

          {/* Right: Quick Comments Button (Adults only) & Volume Control */}
          <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[120px] text-xs text-muted-foreground">
            {currentUser && !currentUser.isUnderage && currentPlayingTrack && (
              <button
                type="button"
                onClick={() => setIsCommentsExpanded((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer transition-colors shadow-2xs font-sans",
                  isCommentsExpanded
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-background/80 hover:bg-surface text-foreground"
                )}
                title={isCommentsExpanded ? "Fechar painel de comentários" : "Comentários da faixa atual"}
              >
                <span>{isCommentsExpanded ? "✕" : "💬"}</span>
                <span className="hidden md:inline font-medium text-[11px]">
                  {isCommentsExpanded ? "Fechar" : "Comentários"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted || volume === 0 ? "Ativar som" : "Silenciar"}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              <VolumeIcon level={isMuted || volume === 0 ? "muted" : volume < 50 ? "low" : "high"} size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value))
                setIsMuted(false)
              }}
              aria-label="Volume"
              className="w-16 sm:w-24 h-1.5 cursor-pointer"
              style={{ accentColor: currentPlaylist.color }}
            />
          </div>
        </div>

        {/* Seção de comentários integrada: revelada quando a barra de música sobe */}
        {isCommentsExpanded && currentUser && !currentUser.isUnderage && currentPlayingTrack && (
          <TrackComments
            key={currentPlayingTrack.id}
            track={currentPlayingTrack}
            user={currentUser}
            currentPlaybackSec={currentElapsedSec}
            onSeek={(seconds) => {
            setPlaybackSec(Math.max(0, Math.min(currentDurationSec, Math.round(seconds))))
            setIsPlaying(true)
            }}
          />
        )}
      </div>
      </main>

      {/* Backdrop ao expandir comentários */}
      {isCommentsExpanded && currentUser && !currentUser.isUnderage && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-300"
          onClick={() => setIsCommentsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          EDIT COLOR MODAL
          ========================================================================= */}
      <Dialog open={isColorModalOpen} onOpenChange={setIsColorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Cor da Playlist</DialogTitle>
            <DialogDescription>
              A cor selecionada atualiza o encarte e o fundo dinâmico da página.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <ColorPicker
              color={currentPlaylist.color}
              onChange={handleUpdateColor}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => setIsColorModalOpen(false)}
                className="h-9 text-xs font-bold"
              >
                Concluir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
