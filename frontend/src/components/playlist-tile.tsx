import Link from "next/link"
import { getContrastTextColor } from "@/components/color-picker"
import { type PlaylistData, getPlaylistInitials } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

// A playlist's sleeve in small, as on /playlist: its color, the printed frame, the initials and
// the name. The whole tile opens the playlist.
export function PlaylistTile({ playlist }: { playlist: PlaylistData }) {
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className={cn(
        "relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl p-5",
        "shadow-[0_1px_2px_rgba(23,21,18,0.12)] transition-shadow duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:shadow-[0_1px_2px_rgba(23,21,18,0.12),0_16px_32px_-16px_rgba(23,21,18,0.45)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current",
        getContrastTextColor(playlist.color)
      )}
      style={{ backgroundColor: playlist.color }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-2.5 rounded-sm border border-current opacity-25" />
      <span aria-hidden="true" className="relative text-5xl leading-none font-medium tracking-[-0.03em]">
        {getPlaylistInitials(playlist.name)}
      </span>
      <span className="relative truncate text-sm font-medium">{playlist.name}</span>
    </Link>
  )
}
