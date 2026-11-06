"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { getContrastTextColor, getPlaylistAccentStyle } from "@/components/color-picker"
import { PauseIcon, PlayIcon, QueueIcon, SkipBackIcon, SkipForwardIcon, VolumeIcon } from "@/components/icons"
import { apiUrl } from "@/lib/api/client"
import { playPlaylist, selectTrackAt, togglePlayback, usePlayback } from "@/lib/playback-store"
import { seekTo, setVolume, toggleMute, useAudioPlayer } from "@/lib/audio-player"
import { formatDuration } from "@/lib/format-duration"
import { getPlaylistInitials, type Track, usePlaylistData } from "@/lib/playlist-store"
import { useTrackCover } from "@/lib/track-cover"
import { cn } from "@/lib/utils"

// Tracks played on their own use the default accent (--color-red in globals.css)
const DEFAULT_COLOR = "#d33a2c"

// Pages without the bar: the landing and the sign-in/sign-up pages
const HIDDEN_ON = new Set(["/", "/entrar", "/cadastro"])

// The arrow keys on the progress bar move this many seconds
const SEEK_STEP_SECONDS = 5

// Where the queue button returns to when it closes the player: the page it was opened from.
// Module state, so it survives the client-side navigation; after a reload the fallback is used.
let playerReturnPath: string | null = null

interface PlaybackBarProps {
  track: Track | undefined
  /** Text on the mini cover (initials), shown when the track's album has no cover */
  coverLabel: string
  /** API path of the cover of the track's album, if it has one */
  coverUrl: string | null
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

// The app's bottom bar, on every page but the landing and the sign-in/sign-up pages. It shows what is playing (see
// playback-store). With nothing playing, a playlist page offers its own playlist: play or the
// queue button start it; elsewhere the bar shows "Nada tocando" with the controls off.
export function AppPlaybackBar() {
  const pathname = usePathname()
  const playback = usePlayback()
  // The playlist the queue came from, or (with nothing playing) the one on this page; both come
  // from the same cache the playlist page fills
  const pagePlaylistId = /^\/playlist\/([^/]+)$/.exec(pathname)?.[1]
  const sourceId = playback ? (playback.origin?.playlistId ?? null) : pagePlaylistId
  const { data: sourcePlaylist } = usePlaylistData(sourceId)
  const pagePlaylist = playback ? null : sourcePlaylist
  const playlist = sourcePlaylist ?? null
  const tracks = playback ? playback.queue : (pagePlaylist?.tracks ?? [])
  const currentIndex = playback?.currentIndex ?? 0
  const track = tracks[currentIndex]
  const coverUrl = useTrackCover(track?.id)
  if (HIDDEN_ON.has(pathname)) return null

  // Moves within the queue (wrapping); with nothing playing yet, starts the page's playlist there
  const goTo = (index: number) => {
    const wrapped = (index + tracks.length) % tracks.length
    if (!tracks[wrapped]) return
    if (playback) selectTrackAt(wrapped)
    else if (pagePlaylist) playPlaylist(pagePlaylist, wrapped)
  }

  return (
    <PlaybackBar
      track={track}
      coverLabel={getPlaylistInitials(playlist?.name ?? (track?.album || track?.title || ""))}
      coverUrl={coverUrl}
      color={playlist?.color ?? DEFAULT_COLOR}
      isPlaying={Boolean(playback?.isPlaying)}
      onTogglePlay={() => (playback ? togglePlayback() : goTo(currentIndex))}
      onPrevious={() => goTo(currentIndex - 1)}
      onNext={() => goTo(currentIndex + 1)}
      queueOpen={pathname === "/player"}
      onOpenQueue={() => {
        if (!playback) goTo(currentIndex)
      }}
      closeQueueHref={playlist ? `/playlist/${playlist.id}` : "/playlist"}
    />
  )
}

// Bottom audio controller: current track, play controls with a scrubber, the queue button
// (opens or closes the player) and volume. Sticky at the end of the page, so it stays on screen
// without covering the end of the content.
export function PlaybackBar({
  track,
  coverLabel,
  coverUrl,
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
  const { currentTime, duration, volume, isMuted, unavailableTrackIds } = useAudioPlayer()
  const isUnavailable = track ? unavailableTrackIds.has(track.id) : false
  // Until the file's metadata loads, the catalog's duration stands in
  const totalSec = duration ?? track?.durationSec ?? 0
  const progressPercent = totalSec > 0 ? Math.min(100, (currentTime / totalSec) * 100) : 0
  const volumePercent = Math.round(volume * 100)

  const toggleQueue = () => {
    if (queueOpen) {
      router.push(playerReturnPath ?? closeQueueHref)
      return
    }
    onOpenQueue?.()
    // With the query string, so closing returns to the same search or filter
    playerReturnPath = pathname + window.location.search
    router.push("/player")
  }

  return (
    <div
      className="sticky bottom-0 z-30 h-20 w-full shrink-0 bg-surface/95 backdrop-blur-md border-t border-border px-4 sm:px-6 flex items-center justify-between shadow-lg"
      // The bar sits outside the pages, so it carries the accent of what it plays itself
      style={getPlaylistAccentStyle(color)}
    >
      {/* Left: Track Name & Mini Cover */}
      {/* Phones show only the cover, so the column reserves its width from sm up */}
      <div className="flex items-center gap-3 shrink-0 sm:w-1/4 sm:min-w-[140px]">
        {coverUrl ? (
          // Decorative: the track's title is printed right beside it
          // oxlint-disable-next-line nextjs/no-img-element
          <img
            src={apiUrl(coverUrl)}
            alt=""
            decoding="async"
            className="size-10 rounded-lg object-cover shrink-0 border border-black/10 shadow-2xs"
          />
        ) : (
          <div
            className="size-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-black/10 shadow-2xs"
            style={{ backgroundColor: color }}
          >
            <span className={cn(getContrastTextColor(color))}>{coverLabel}</span>
          </div>
        )}
        <div className="min-w-0 hidden sm:block">
          <div className="font-bold text-xs text-foreground truncate">{track?.title ?? "Nada tocando"}</div>
          <div className="text-[11px] text-muted-foreground truncate">{isUnavailable ? "Indisponível" : track?.artist}</div>
        </div>
      </div>

      {/* Center: Playback Controls & Progress Scrubber */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-md px-2">
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Faixa anterior"
            disabled={!track}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40"
          >
            <SkipBackIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar reprodução" : "Iniciar reprodução"}
            disabled={!track || isUnavailable}
            className="size-8 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer hover:scale-105 transition-transform disabled:pointer-events-none disabled:opacity-40"
          >
            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Próxima faixa"
            disabled={!track}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40"
          >
            <SkipForwardIcon size={18} />
          </button>
        </div>

        {/* Scrubber in the accent color */}
        <div className="w-full flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span>{formatDuration(Math.floor(currentTime))}</span>
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const clickX = e.clientX - rect.left
              seekTo((clickX / rect.width) * totalSec)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                seekTo(currentTime + SEEK_STEP_SECONDS)
              } else if (e.key === "ArrowLeft") {
                seekTo(currentTime - SEEK_STEP_SECONDS)
              }
            }}
            aria-label="Avançar ou retroceder na reprodução"
            disabled={!track || isUnavailable}
            className="relative flex-1 h-3 flex items-center cursor-pointer group focus:outline-none"
          >
            <span className="w-full h-1.5 bg-border rounded-full overflow-hidden block">
              <span
                className="h-full rounded-full transition-all block"
                style={{ width: `${progressPercent}%`, backgroundColor: color }}
              />
            </span>
          </button>
          <span>{formatDuration(Math.round(totalSec))}</span>
        </div>
      </div>

      {/* Right: Queue (player view) & Volume */}
      <div className="flex items-center justify-end gap-2 shrink-0 sm:w-1/4 sm:min-w-[120px] text-xs text-muted-foreground">
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
          onClick={toggleMute}
          aria-label={isMuted || volume === 0 ? "Ativar som" : "Silenciar"}
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          <VolumeIcon level={isMuted || volume === 0 ? "muted" : volumePercent < 50 ? "low" : "high"} size={18} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : volumePercent}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
          // Phones set the volume with their own buttons; the mute toggle stays
          className="hidden sm:block w-28 h-1.5 cursor-pointer"
          style={{ accentColor: color }}
        />
      </div>
    </div>
  )
}
