import { apiUrl } from "@/lib/api/client"
import { cn } from "@/lib/utils"

/**
 * An uploaded image (playlist cover, artist photo) filling its parent, which must be `relative`
 * and clip its corners. Nothing when there is no image: the parent's color and initials show.
 * `url` is the API path; `previewUrl`, a chosen file not uploaded yet, wins over it.
 */
export function CoverPhoto({
  url,
  previewUrl,
  className,
}: {
  url: string | null | undefined
  previewUrl?: string | null
  className?: string
}) {
  const source = previewUrl ?? (url ? apiUrl(url) : null)
  if (!source) return null
  // Decorative: every place that shows it also prints the playlist's or the artist's name
  // oxlint-disable-next-line nextjs/no-img-element
  return <img src={source} alt="" decoding="async" className={cn("pointer-events-none absolute inset-0 size-full object-cover", className)} />
}
