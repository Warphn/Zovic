"use client"

import * as React from "react"
import Link from "next/link"
import Header from "@/components/header"
import { getPlaylistAccentStyle } from "@/components/color-picker"
import { ArrowRightIcon, PauseIcon, PlayIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { selectTrackAt, togglePlayback, usePlayback } from "@/lib/playback-store"
import { getPlaylistInitials, type Track, usePlaylistData } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"
import { LevelBars } from "@/components/playback-marks"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"

// Depth of the row: each track further down sits this much deeper and turns this much away
const DEPTH_STEP_PX = 90
const CURRENT_TILT_DEG = 8
const QUEUE_TILT_DEG = 14
// The current card is this many slots wide; the others are drawn at its size and scaled down
// by it (square cards, so 2 slots fill the row's height)
const CURRENT_SCALE = 2

// Stable empty queue, so the effects below do not rerun on every render with nothing playing
const NO_TRACKS: Track[] = []

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
  const { data: sourcePlaylist } = usePlaylistData(playback?.origin?.playlistId ?? null)
  const playlist = sourcePlaylist ?? null
  const tracks = playback?.queue ?? NO_TRACKS
  const currentIndex = playback?.currentIndex ?? 0
  const isPlaying = Boolean(playback?.isPlaying)

  // Clicking the current track plays or pauses it; clicking any other track plays that one
  const onCardClick = (index: number) => {
    if (index === currentIndex) togglePlayback()
    else selectTrackAt(index, true)
  }

  // Walks the queue one track at a time, keeping play/pause; stops at either end
  const moveBy = (step: number) => {
    if (tracks[currentIndex + step]) selectTrackAt(currentIndex + step)
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
      const nextIndex = currentIndex + (delta > 0 ? 1 : -1)
      if (tracks[nextIndex]) selectTrackAt(nextIndex)
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
        const nextIndex = currentIndex + (e.key === "ArrowRight" ? 1 : -1)
        if (tracks[nextIndex]) selectTrackAt(nextIndex)
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
      <div className="flex-1 bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1 pt-24 px-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-medium mb-2">Nada tocando</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Toque uma playlist ou busque uma faixa para começar
          </p>
          <Button render={<Link href="/playlist" />} nativeButton={false} size="lg" className="h-9 px-4 text-sm">
            Ver playlists
          </Button>
        </main>
      </div>
    )
  }

  const totalSec = sumDurationSec(tracks)
  const startTrack = tracks[0]

  return (
    <div
      className="flex-1 bg-background text-foreground flex flex-col"
      // A playlist lends its color to the page; tracks played on their own keep the default red
      style={playlist ? getPlaylistAccentStyle(playlist.color) : undefined}
    >
      <Header />

      <main className="relative flex-1 pt-16 flex flex-col overflow-hidden">
        {/* Title block: the playlist, or the suggestions that follow a lone track */}
        <div className="relative w-full max-w-6xl mx-auto px-6 md:px-8 pt-10">
          {playlist ? (
            <>
              <p className="mb-3 font-mono text-xs text-muted-foreground">Playlist</p>
              {/* The arrow flows inline with the name, so it follows the last word when the name wraps */}
              <h1 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl">
                <Link
                  href={`/playlist/${playlist.id}`}
                  className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {playlist.name}
                  <ArrowRightIcon size={24} className="ml-2 align-middle text-primary" />
                </Link>
              </h1>
              <p className="mt-4 font-mono text-xs text-muted-foreground tabular-nums">
                {tracks.length} {tracks.length === 1 ? "faixa" : "faixas"} · {formatTotalDuration(totalSec)}
              </p>
            </>
          ) : (
            <>
              <p className="mb-3 font-mono text-xs text-muted-foreground">Tocando agora</p>
              <h1 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl">
                A partir de {startTrack?.title}
              </h1>
              <p className="mt-4 font-mono text-xs text-muted-foreground tabular-nums">
                {tracks.length - 1} {tracks.length - 1 === 1 ? "sugestão" : "sugestões"} · {formatTotalDuration(totalSec)}
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
            {/* Fixed height, the current card's size: the cards sit absolutely over their slots,
                so the row would otherwise be only as tall as a slot */}
            <ul
              className="h-80 sm:h-96 flex items-center gap-(--gap) transform-3d transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(calc(var(--step) * (var(--prev-slots) - ${currentIndex})))` }}
            >
              {tracks.map((track, index) => (
                <TrackCard
                  // The same music can be queued twice: its position tells the cards apart
                  key={`${index}-${track.id}`}
                  track={track}
                  distance={index - currentIndex}
                  isPlaying={isPlaying && index === currentIndex}
                  onClick={() => onCardClick(index)}
                />
              ))}
            </ul>
          </div>
        </div>

        {/* Footer: keyboard and mouse hint */}
        <div className="relative w-full max-w-6xl mx-auto px-6 md:px-8 pb-10">
          <p className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">Enter</kbd>
              {isPlaying ? "Pausar" : "Tocar"}
            </span>
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">← →</kbd>
              Navegar · role ou arraste
            </span>
          </p>
        </div>
      </main>

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
  // Each slot in the row is a small square (one --step minus the gap). The card itself is drawn
  // at the current card's size, two slots wide, and the others are scaled down to fit their slot:
  // scaling down stays sharp, scaling a small card up would blur it. The card is centered on its
  // slot's middle line and scaled from its own center, so a small card needs half a slot to the
  // left to sit on its slot, the current card none (it starts at its slot and covers the next
  // one), and the cards after it half a slot to the right to clear it. Only transforms change.
  const shift = isCurrent ? "0px" : isPast ? "calc(var(--slot) / -2)" : "calc(var(--slot) / 2)"

  return (
    // The slot: keeps the row's spacing; its card is positioned over it
    <li className="relative size-(--slot) shrink-0 transform-3d [--slot:calc(var(--step)-var(--gap))]">
      <div
        // Older tracks left the row; keep them out of reach until they come back
        inert={isPast && !isPrevious}
        className={cn(
          "absolute top-1/2 left-0 -mt-(--slot) size-[calc(var(--slot)*2)] overflow-hidden rounded-[24px] border border-black/10 bg-primary p-8 text-primary-foreground",
          "shadow-[0_32px_60px_-24px_rgba(23,21,18,0.55)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isPast && (isPrevious ? "opacity-0 sm:opacity-55 sm:hover:opacity-80" : "opacity-0")
        )}
        style={{
          transform: `translateX(${shift}) translateZ(${-depth}px) rotateY(${tilt}deg) scale(${isCurrent ? 1 : 1 / CURRENT_SCALE})`,
          // Nearer cards cover the ones behind them
          zIndex: 100 - Math.abs(distance),
          opacity,
        }}
      >
        {/* Printed frame, the same rule as on the sleeves of the playlist pages */}
        <div className="pointer-events-none absolute inset-3 rounded-sm border border-current opacity-25" />

        {/* Card-wide button: a click anywhere plays or pauses this track */}
        <button
          type="button"
          onClick={onClick}
          aria-label={isPlaying ? `Pausar ${track.title}` : `Tocar ${track.title}`}
          aria-pressed={isPlaying}
          className="absolute inset-0 z-10 cursor-pointer rounded-[24px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/60"
        />

        {/* One layout for every card, at the current card's size; small cards are this at half size */}
        <div className="pointer-events-none relative flex h-full flex-col justify-between">
          <span className="select-none text-6xl leading-none font-medium tracking-[-0.03em]">
            {getPlaylistInitials(track.album || track.title)}
          </span>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-3 text-[28px] leading-tight font-medium tracking-[-0.02em]">
                <span className="truncate">{track.title}</span>
                {isPlaying && <LevelBars playing className="h-5 shrink-0" />}
              </p>
              <p className="truncate text-xl opacity-75">{track.artist}</p>
            </div>
            {/* Flat, in the sleeve's own ink */}
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-black/15">
              {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}
