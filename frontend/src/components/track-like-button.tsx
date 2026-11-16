"use client"

import { useQueryClient } from "@tanstack/react-query"
import { HeartIcon } from "@/components/icons"
import { likedMusicsApi, playlistKeys } from "@/lib/api/playlists"
import { useSession } from "@/lib/auth/client"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"

// Catalog tracks have the music's numeric id; the landing's sample tracks have none
const CATALOG_TRACK_ID = /^\d+$/

export function TrackLikeButton({ trackId }: { trackId: string }) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const userId = Number(session?.user.id)
  const { isLiked, toggleLike } = useLikedTracks(Number.isFinite(userId) ? userId : 0)

  if (!session?.user) return null

  const liked = isLiked(trackId)

  // The heart stays in this browser (HU-20 will keep it in the API); "Músicas Curtidas" (HU-34) follows it
  const toggle = () => {
    toggleLike(trackId)
    if (!CATALOG_TRACK_ID.test(trackId)) return
    const musicId = Number(trackId)
    const request = liked ? likedMusicsApi.unlike(musicId) : likedMusicsApi.like(musicId)
    request
      .then(() => queryClient.invalidateQueries({ queryKey: playlistKeys.all }))
      // A playlist that could not follow must not undo the heart
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={liked ? "Descurtir faixa" : "Curtir faixa"}
      aria-pressed={liked}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2",
        liked ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
      )}
    >
      <HeartIcon size={16} />
    </button>
  )
}
