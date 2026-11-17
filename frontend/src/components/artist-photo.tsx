import { getContrastTextColor } from "@/components/color-picker"
import { CoverPhoto } from "@/components/cover-photo"
import { getPlaylistInitials } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

/** Color behind an artist without a photo, the same as in the search. */
const ARTIST_COLOR = "#565043"

/** The artist's photo in a circle (HU-36), or, without one, the initials on the artist color. `className` sets its size. */
export function ArtistPhoto({ artist, className }: { artist: { name: string; imageUrl: string | null }; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-medium select-none",
        getContrastTextColor(ARTIST_COLOR),
        className
      )}
      style={{ backgroundColor: ARTIST_COLOR }}
    >
      <CoverPhoto url={artist.imageUrl} />
      {!artist.imageUrl && getPlaylistInitials(artist.name)}
    </span>
  )
}
