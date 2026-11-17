"use client"

import { AlbumCoverImage } from "@/components/album-cover-image"
import { useTrackAlbum } from "@/lib/track-cover"
import { cn } from "@/lib/utils"

/**
 * The cover of the album a track is part of, beside it in a list; without an album (a single),
 * an empty square of the same size keeps the titles aligned. Decorative: the row says the title.
 */
export function TrackAlbumCover({ trackId, className }: { trackId: string; className?: string }) {
  const album = useTrackAlbum(trackId)
  if (!album) return <span aria-hidden="true" className={cn("shrink-0 rounded-md bg-muted", className)} />
  return <AlbumCoverImage album={album} className={cn("shrink-0 rounded-md text-[10px]", className)} />
}
