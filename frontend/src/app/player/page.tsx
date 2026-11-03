"use client"

import * as React from "react"
import Link from "next/link"
import Header from "@/components/header"
import { getPlaylistAccentStyle } from "@/components/color-picker"
import { ArrowRightIcon, PauseIcon, PlayIcon } from "@/components/icons"
import { PlaybackBar } from "@/components/playback-bar"
import { Button } from "@/components/ui/button"
import { resolveQueue, selectTrack, togglePlayback, usePlayback } from "@/lib/playback-store"
import { getPlaylistInitials, useStoredPlaylists, type Track } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

// Tracks played on their own use the default accent (--color-red in globals.css)
const DEFAULT_COLOR = "#d33a2c"

// Depth of the row: each track further down sits this much deeper and turns this much away
const DEPTH_STEP_PX = 90
const CURRENT_TILT_DEG = 8
const QUEUE_TILT_DEG = 14

// "2h 14min" past an hour, "23 min" below it
function formatTotalDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.round((totalSec % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`
}

// Keys typed into a field belong to it (the header search, for one), not to the player
function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable]"))
}

// Enter and Space already activate a focused button or link
function isActivatable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a"))
}

// The player shows what is playing now: a playlist, or a track played on its own followed by
// suggestions. Every page shares that playback, so this page only reads and steers it.
export default function PlayerPage() {
  const playback = usePlayback()
  const { playlists } = useStoredPlaylists()
  const { tracks, playlist } = resolveQueue(playback, playlists)
  const currentIndex = Math.max(0, tracks.findIndex((t) => t.id === playback?.currentTrackId))
  const isPlaying = Boolean(playback?.isPlaying)

  // Clicking the current track plays or pauses it; clicking any other track plays that one
  const onCardClick = (track: Track) => {
    if (track.id === playback?.currentTrackId) togglePlayback()
    else selectTrack(track.id, true)
  }

  // Walks the queue one track at a time, keeping play/pause; stops at either end
  const moveBy = (step: number) => {
    const next = tracks[currentIndex + step]
    if (next) selectTrack(next.id)
  }
  // Mouse wheel (or trackpad) over the row moves one track per gesture: after a step, more
  // wheel events are ignored until they pause, so a trackpad's inertia does not skip several.
  // A native listener, because React's wheel listener is passive and cannot stop the page scroll.
  // The gesture lives in a ref: the listener is re-added on every move, the gesture must survive it.
  const rowRef = React.useRef<HTMLDivElement>(null)
  const wheelGesture = React.useRef<{ locked: boolean; idle?: ReturnType<typeof setTimeout> }>({ locked: false })
  React.useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const gesture = wheelGesture.current
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 4) return
      e.preventDefault()
      clearTimeout(gesture.idle)
      gesture.idle = setTimeout(() => {
        gesture.locked = false
      }, 180)
      if (gesture.locked) return
      gesture.locked = true
      const next = tracks[currentIndex + (delta > 0 ? 1 : -1)]
      if (next) selectTrack(next.id)
    }
    row.addEventListener("wheel", onWheel, { passive: false })
    return () => row.removeEventListener("wheel", onWheel)
  }, [rowRef, tracks, currentIndex])

  // Dragging the row (mouse or finger) sideways moves one track; the click that ends a drag
  // is swallowed so it does not also play the card under the pointer
  const drag = React.useRef<{ x: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, moved: false }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const start = drag.current
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 40) {
      start.moved = true
      moveBy(dx < 0 ? 1 : -1)
    }
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.stopPropagation()
      e.preventDefault()
    }
    drag.current = null
  }

  // Arrow keys walk the queue (keeping play/pause); Enter or Space plays/pauses when nothing
  // else has focus
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextField(e.target)) return
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault()
        const next = tracks[currentIndex + (e.key === "ArrowRight" ? 1 : -1)]
        if (next) selectTrack(next.id)
      } else if ((e.key === "Enter" || e.key === " ") && !isActivatable(e.target)) {
        e.preventDefault()
        togglePlayback()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [tracks, currentIndex])

  if (tracks.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1 pt-24 px-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold mb-2">Nada tocando</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Toque uma playlist ou busque uma música para começar.
          </p>
          <Button render={<Link href="/playlist" />} nativeButton={false} className="text-xs font-semibold">
            Ver playlists
          </Button>
        </main>
      </div>
    )
  }

  const totalSec = tracks.reduce((acc, t) => acc + t.durationSec, 0)
  const startTrack = tracks[0]
  const currentTrack = tracks[currentIndex]
  // The bar's skip buttons wrap around the queue
  const skip = (step: number) => {
    const next = tracks[(currentIndex + step + tracks.length) % tracks.length]
    if (next) selectTrack(next.id)
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-foreground"
      // A playlist lends its color to the page; tracks played on their own keep the default red
      style={playlist ? getPlaylistAccentStyle(playlist.color) : undefined}
    >
      <Header />

      {/* pb-20 keeps the footer clear of the fixed playback bar */}
      <main className="relative flex-1 pt-16 pb-20 flex flex-col overflow-hidden">
        {/* Soft glow of the accent color from the right edge */}
        <div className="pointer-events-none absolute -right-40 top-1/4 size-[36rem] rounded-full bg-primary opacity-15 blur-3xl" />

        {/* Title block: the playlist, or the suggestions that follow a lone track */}
        <div className="relative w-full max-w-6xl mx-auto px-6 md:px-8 pt-10">
          {playlist ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">Playlist</p>
              {/* The arrow flows inline with the name, so it follows the last word when the name wraps */}
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <Link
                  href={`/playlist/${playlist.id}`}
                  className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {playlist.name}
                  <ArrowRightIcon size={24} className="ml-2 align-middle text-primary" />
                </Link>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {tracks.length} {tracks.length === 1 ? "música" : "músicas"}
                <span className="mx-2 opacity-50">•</span>
                {formatTotalDuration(totalSec)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">Tocando agora</p>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">Sugestões para você</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A partir de {startTrack?.title}
                <span className="mx-2 opacity-50">•</span>
                {tracks.length - 1} {tracks.length - 1 === 1 ? "sugestão" : "sugestões"}
              </p>
            </>
          )}
        </div>

        {/* Track row in perspective: the current track stands big, the previous one (to go back)
            sits at its left and the rest of the queue recedes to its right, each card deeper and
            turned a little away. The row slides one --step (a small card's width plus the gap) per
            track, so the offset is pure CSS; --prev-slots reserves the previous track's place
            (none on phones, where it would push the current card off screen). The vanishing
            point sits at the current card's left edge. */}
        <div
          ref={rowRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClickCapture={onClickCapture}
          className="relative flex-1 min-h-0 flex items-center py-10 select-none touch-pan-y"
        >
          <div
            className="w-full max-w-6xl mx-auto px-6 md:px-8 perspective-[1600px] [--gap:1rem] [--step:11rem] [--pad:1.5rem] [--prev-slots:0] sm:[--step:13rem] sm:[--prev-slots:1] md:[--pad:2rem]"
            style={{ perspectiveOrigin: "calc(var(--pad) + var(--step) * var(--prev-slots)) 50%" }}
          >
            {/* Fixed height: the cards swap sizes while they animate, and a row that followed
                them would shake the page up and down */}
            <ul
              className="h-80 sm:h-96 flex items-center gap-(--gap) transform-3d transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(calc(var(--step) * (var(--prev-slots) - ${currentIndex})))` }}
            >
              {tracks.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  distance={index - currentIndex}
                  isPlaying={isPlaying && index === currentIndex}
                  onClick={() => onCardClick(track)}
                />
              ))}
            </ul>
            {/* Reflection of the current card on the floor */}
            <div className="pointer-events-none mt-2 ml-[calc(var(--step)*var(--prev-slots))] h-10 w-[min(70vw,24rem)] rounded-full bg-primary opacity-20 blur-2xl" />
          </div>
        </div>

        {/* Footer: keyboard and mouse hint */}
        <div className="relative w-full max-w-6xl mx-auto px-6 md:px-8 pb-10">
          <p className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
              {isPlaying ? "Pausar" : "Tocar"}
            </span>
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">← →</kbd>
              Navegar (ou role e arraste)
            </span>
          </p>
        </div>
      </main>

      {/* Same bottom bar as the other pages; its queue button closes the player */}
      <PlaybackBar
        track={currentTrack}
        coverLabel={getPlaylistInitials(playlist?.name ?? currentTrack?.album ?? "")}
        color={playlist?.color ?? DEFAULT_COLOR}
        isPlaying={isPlaying}
        onTogglePlay={togglePlayback}
        onPrevious={() => skip(-1)}
        onNext={() => skip(1)}
        queueOpen
        closeQueueHref={playlist ? `/playlist/${playlist.id}` : "/playlist"}
      />
    </div>
  )
}

interface TrackCardProps {
  track: Track
  /** Position relative to the current track: 0 is current, negative already went by */
  distance: number
  isPlaying: boolean
  onClick: () => void
}

function TrackCard({ track, distance, isPlaying, onClick }: TrackCardProps) {
  const isCurrent = distance === 0
  const isPast = distance < 0
  const isPrevious = distance === -1
  // Further down the queue: deeper, turned away (right edge back) and a little faded. The
  // previous track turns the other way, mirroring the queue; older ones are gone.
  const depth = Math.abs(distance) * DEPTH_STEP_PX
  const tilt = isPast ? -QUEUE_TILT_DEG : isCurrent ? CURRENT_TILT_DEG : QUEUE_TILT_DEG
  // Past cards fade through classes, since the previous one shows only where it has room (sm+)
  const opacity = isPast ? undefined : Math.max(0.5, 1 - distance * 0.1)

  return (
    <li
      // Older tracks left the row; keep them out of reach until they come back
      inert={isPast && !isPrevious}
      className={cn(
        "relative shrink-0 rounded-2xl border border-black/10 overflow-hidden bg-primary text-primary-foreground transition-all duration-500 ease-out motion-reduce:transition-none",
        isPast && (isPrevious ? "opacity-0 sm:opacity-55 sm:hover:opacity-80" : "opacity-0"),
        isCurrent
          ? "w-[min(78vw,26rem)] h-80 sm:h-96 p-6 sm:p-8 shadow-[0_32px_60px_-24px_var(--primary)]"
          : "w-[calc(var(--step)-var(--gap))] h-56 sm:h-64 p-4 shadow-[0_20px_40px_-20px_var(--primary)]"
      )}
      style={{
        transform: `translateZ(${-depth}px) rotateY(${tilt}deg)`,
        // Nearer cards cover the ones behind them
        zIndex: 100 - Math.abs(distance),
        opacity,
      }}
    >
      {/* Sheen over the flat color */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/25" />

      {/* Card-wide button: a click anywhere plays or pauses this track */}
      <button
        type="button"
        onClick={onClick}
        aria-label={isPlaying ? `Pausar ${track.title}` : `Tocar ${track.title}`}
        aria-pressed={isPlaying}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/60"
      />

      <div className="relative h-full flex flex-col justify-between pointer-events-none">
        {/* Cover: no artwork yet, so the album's initials on a lighter tile */}
        <div
          className={cn(
            "aspect-square rounded-xl bg-white/15 border border-white/20 flex items-center justify-center font-black tracking-tighter select-none transition-all duration-500",
            isCurrent ? "w-40 sm:w-48 text-5xl" : "w-24 sm:w-28 text-3xl"
          )}
        >
          {getPlaylistInitials(track.album)}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("font-bold truncate", isCurrent ? "text-2xl" : "text-sm")}>{track.title}</p>
            <p className={cn("truncate opacity-75", isCurrent ? "text-base" : "text-xs")}>{track.artist}</p>
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 rounded-full bg-surface text-primary flex items-center justify-center shadow-md",
              isCurrent ? "size-14" : "size-8"
            )}
          >
            {isPlaying ? <PauseIcon size={isCurrent ? 22 : 14} /> : <PlayIcon size={isCurrent ? 22 : 14} />}
          </span>
        </div>
      </div>
    </li>
  )
}
