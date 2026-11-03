"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { getContrastTextColor } from "@/components/color-picker"
import { PauseIcon, PlayIcon, QueueIcon, SkipBackIcon, SkipForwardIcon, VolumeIcon } from "@/components/icons"
import type { Track } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

// Where the queue button returns to when it closes the player: the page it was opened from.
// Module state, so it survives the client-side navigation; after a reload the fallback is used.
let playerReturnPath: string | null = null

interface PlaybackBarProps {
  track: Track | undefined
  /** Text on the mini cover (initials) */
  coverLabel: string
  /** Color of the mini cover, the scrubber and the volume slider */
  color: string
  isPlaying: boolean
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  /** True on the player: the queue button then closes it */
  queueOpen: boolean
  /** Runs before the queue button opens the player (e.g. to start what this page shows) */
  onOpenQueue?: () => void
  /** Where closing the player goes when the page it came from is unknown */
  closeQueueHref: string
}

// Bottom audio controller: current track, play controls with a scrubber, the queue button
// (opens or closes the player) and volume.
export function PlaybackBar({
  track,
  coverLabel,
  color,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  queueOpen,
  onOpenQueue,
  closeQueueHref,
}: PlaybackBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [playbackProgress, setPlaybackProgress] = React.useState(35) // percentage 0-100
  const [volume, setVolume] = React.useState(70) // percentage 0-100
  const [isMuted, setIsMuted] = React.useState(false)

  const toggleQueue = () => {
    if (queueOpen) {
      router.push(playerReturnPath ?? closeQueueHref)
      return
    }
    onOpenQueue?.()
    playerReturnPath = pathname
    router.push("/player")
  }

  // Calculate current elapsed time in mm:ss from playbackProgress
  const currentElapsedSec = Math.round(((track?.durationSec ?? 240) * playbackProgress) / 100)
  const elapsedMin = Math.floor(currentElapsedSec / 60)
  const elapsedSecFormatted = (currentElapsedSec % 60).toString().padStart(2, "0")

  return (
    <div className="fixed bottom-0 inset-x-0 h-20 bg-surface/95 backdrop-blur-md border-t border-border px-6 flex items-center justify-between z-40 shadow-lg">
      {/* Left: Track Name & Mini Cover */}
      <div className="flex items-center gap-3 w-1/4 min-w-[140px]">
        <div
          className="size-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-black/10 shadow-2xs"
          style={{ backgroundColor: color }}
        >
          <span className={cn(getContrastTextColor(color))}>{coverLabel}</span>
        </div>
        <div className="min-w-0 hidden sm:block">
          <div className="font-bold text-xs text-foreground truncate">{track?.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{track?.artist}</div>
        </div>
      </div>

      {/* Center: Playback Controls & Progress Scrubber */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-md px-2">
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Faixa anterior"
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <SkipBackIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar reprodução" : "Iniciar reprodução"}
            className="size-8 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          >
            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Próxima faixa"
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <SkipForwardIcon size={18} />
          </button>
        </div>

        {/* Scrubber in the accent color */}
        <div className="w-full flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span>{isPlaying ? `${elapsedMin}:${elapsedSecFormatted}` : "0:00"}</span>
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const clickX = e.clientX - rect.left
              const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
              setPlaybackProgress(Math.round(percentage))
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                setPlaybackProgress((p) => Math.min(100, p + 5))
              } else if (e.key === "ArrowLeft") {
                setPlaybackProgress((p) => Math.max(0, p - 5))
              }
            }}
            aria-label="Avançar ou retroceder na reprodução"
            className="relative flex-1 h-3 flex items-center cursor-pointer group focus:outline-none"
          >
            <span className="w-full h-1.5 bg-border rounded-full overflow-hidden block">
              <span
                className="h-full rounded-full transition-all block"
                style={{ width: `${playbackProgress}%`, backgroundColor: color }}
              />
            </span>
          </button>
          <span>{track?.duration || "0:00"}</span>
        </div>
      </div>

      {/* Right: Queue (player view) & Volume */}
      <div className="flex items-center justify-end gap-2 w-1/4 min-w-[120px] text-xs text-muted-foreground">
        <button
          type="button"
          onClick={toggleQueue}
          aria-label={queueOpen ? "Fechar fila" : "Abrir fila"}
          aria-pressed={queueOpen}
          className={cn(
            "relative mr-2 flex size-8 items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            queueOpen ? "text-primary" : "hover:text-foreground"
          )}
        >
          {/* Mirrored so the stack trails to the right, as the queue does in the player */}
          <QueueIcon size={18} className="-scale-x-100" />
          {/* Dot under the icon while the player is open */}
          {queueOpen && <span className="absolute bottom-0 size-1 rounded-full bg-primary" />}
        </button>
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
          className="w-20 sm:w-28 h-1.5 cursor-pointer"
          style={{ accentColor: color }}
        />
      </div>
    </div>
  )
}
