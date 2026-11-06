import { getContrastTextColor } from "@/components/color-picker"
import { apiUrl } from "@/lib/api/client"
import { albumCover } from "@/lib/album-cover"
import { cn } from "@/lib/utils"

/** The uploaded cover, or (for older albums without one) the initials on a palette color. */
export function AlbumCoverImage({
  album,
  previewUrl,
  className,
}: {
  album: { id: number; name: string; coverUrl: string | null }
  /** A local file not uploaded yet, shown in place of the album's cover. */
  previewUrl?: string | null
  className?: string
}) {
  const source = previewUrl ?? (album.coverUrl ? apiUrl(album.coverUrl) : null)
  if (source) {
    // The cover is decorative next to the album name, which every place that shows it also prints
    // oxlint-disable-next-line nextjs/no-img-element
    return <img src={source} alt="" decoding="async" className={cn("rounded-lg object-cover", className)} />
  }
  const cover = albumCover(album)
  return (
    <div
      aria-hidden="true"
      className={cn("grid place-items-center rounded-lg font-semibold tracking-wide", getContrastTextColor(cover.color), className)}
      style={{ background: cover.color }}
    >
      {cover.initials}
    </div>
  )
}
