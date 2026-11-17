import Link from "next/link"
import { getContrastTextColor } from "@/components/color-picker"
import { CoverPhoto } from "@/components/cover-photo"
import { PlaylistMark } from "@/components/playlist-mark"
import type { PlaylistData } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

// A playlist's sleeve in small, as on /playlist: its color, the printed frame, the initials and
// the name; with a cover image (HU-35), the image in place of the color and the initials. The
// whole tile opens the playlist.
export function PlaylistTile({ playlist }: { playlist: PlaylistData }) {
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className={cn(
        "relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl p-5",
        "shadow-[0_1px_2px_rgba(23,21,18,0.12)] transition-shadow duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:shadow-[0_1px_2px_rgba(23,21,18,0.12),0_16px_32px_-16px_rgba(23,21,18,0.45)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current",
        playlist.coverUrl ? "text-white" : getContrastTextColor(playlist.color)
      )}
      style={{ backgroundColor: playlist.color }}
    >
      {playlist.coverUrl && (
        <>
          <CoverPhoto url={playlist.coverUrl} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/35" />
        </>
      )}
      <span aria-hidden="true" className="pointer-events-none absolute inset-2.5 rounded-sm border border-current opacity-25" />
      <span aria-hidden="true" className="relative text-5xl leading-none font-medium tracking-[-0.03em]">
        {!playlist.coverUrl && <PlaylistMark name={playlist.name} isLikedSongs={playlist.isLikedSongs} iconSize={44} />}
      </span>
      <span className="relative truncate text-sm font-medium">{playlist.name}</span>
    </Link>
  )
}
