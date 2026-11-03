import { getContrastTextColor, getPlaylistAccentStyle } from "@/components/color-picker"
import { LevelBars } from "@/components/playback-marks"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { INITIAL_PLAYLISTS, getPlaylistInitials } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

// The landing hero's visual: the playlist page as the app draws it, with the app's own first
// playlist and its second track playing. Same sleeve, same tracklist, same level bars.
const PLAYLIST = INITIAL_PLAYLISTS[0]
const PLAYING_INDEX = 1

export default function HeroPreview({ className }: { className?: string }) {
  if (!PLAYLIST) return null
  const tracks = PLAYLIST.tracks
  const contrastText = getContrastTextColor(PLAYLIST.color)

  return (
    <figure
      aria-label={`Prévia da playlist ${PLAYLIST.name} no Zovic`}
      // The playlist color is the accent inside the preview, as on its page
      style={getPlaylistAccentStyle(PLAYLIST.color)}
      className={cn(
        "rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_1px_2px_rgba(23,21,18,0.06),0_24px_48px_-24px_rgba(23,21,18,0.35)] sm:p-8",
        className
      )}
    >
      {/* Sleeve and title */}
      <div className="flex items-end gap-6">
        <div
          className={cn(
            "relative flex size-28 shrink-0 items-center justify-center rounded-md shadow-[0_1px_2px_rgba(23,21,18,0.12),0_12px_24px_-12px_rgba(23,21,18,0.45)] sm:size-32",
            contrastText
          )}
          style={{ backgroundColor: PLAYLIST.color }}
        >
          <div className="pointer-events-none absolute inset-2 rounded-sm border border-current opacity-25" />
          <span className="text-4xl font-medium tracking-[-0.03em]">{getPlaylistInitials(PLAYLIST.name)}</span>
        </div>
        <div className="min-w-0 pb-1">
          <p className="mb-2 font-mono text-xs text-muted-foreground">Playlist pública</p>
          <p className="text-2xl leading-tight font-medium tracking-[-0.02em] sm:text-3xl">{PLAYLIST.name}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">
            {tracks.length} faixas · {formatTotalDuration(sumDurationSec(tracks))}
          </p>
        </div>
      </div>

      {/* Tracklist: four tracks on wide screens, three on phones */}
      <ol className="mt-6 border-t border-ink/10 pt-2">
        {tracks.slice(0, 4).map((track, index) => {
          const isPlaying = index === PLAYING_INDEX
          return (
            <li
              key={track.id}
              className={cn(
                "relative flex h-14 items-center gap-4 rounded-lg px-3",
                isPlaying && "bg-background/60",
                index === 3 && "hidden sm:flex"
              )}
            >
              {isPlaying && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" />}
              <span className="flex w-6 shrink-0 justify-end font-mono text-xs text-muted-foreground tabular-nums">
                {isPlaying ? (
                  <span className="text-primary">
                    <LevelBars playing />
                  </span>
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-medium", isPlaying && "text-primary")}>{track.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{track.duration}</span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
