"use client"

import { useQueryClient } from "@tanstack/react-query"
import { HeartIcon } from "@/components/icons"
import { TRACK_ACTION_CLASSES } from "@/components/track-action"
import { dislikeKeys } from "@/lib/api/dislikes"
import { likedMusicsApi, playlistKeys } from "@/lib/api/playlists"
import { recommendationKeys } from "@/lib/api/recommendations"
import { useSession } from "@/lib/auth/client"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"

// Catalog tracks have the music's numeric id; the landing's sample tracks have none
const CATALOG_TRACK_ID = /^\d+$/

// `isInLikedSongs`: the track is in "Músicas Curtidas" (HU-34), so it shows liked even when this
// browser has no heart for it yet (liked elsewhere)
export function TrackLikeButton({ trackId, isInLikedSongs = false }: { trackId: string; isInLikedSongs?: boolean }) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const userId = Number(session?.user.id)
  const effectiveUserId = Number.isFinite(userId) ? userId : 0
  const { isLiked, setLike } = useLikedTracks(effectiveUserId)

  if (!session?.user) return null

  const liked = isLiked(trackId) || isInLikedSongs

  // The heart stays in this browser; "Músicas Curtidas" (HU-34) follows it. The API takes the
  // dislike away on a like (HU-20), so the dislikes and the recommendations reload too
  const toggle = () => {
    const nextLiked = !liked
    setLike(trackId, nextLiked)
    if (!CATALOG_TRACK_ID.test(trackId)) return
    const musicId = Number(trackId)
    const request = nextLiked ? likedMusicsApi.like(musicId) : likedMusicsApi.unlike(musicId)
    request
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: playlistKeys.all }),
          queryClient.invalidateQueries({ queryKey: dislikeKeys.all }),
          queryClient.invalidateQueries({ queryKey: recommendationKeys.all }),
        ])
      )
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
        TRACK_ACTION_CLASSES,
        liked && "text-primary hover:text-primary"
      )}
    >
      <HeartIcon size={16} />
    </button>
  )
}
