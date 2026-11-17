"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ThumbsDownIcon } from "@/components/icons"
import { likedMusicsApi, playlistKeys } from "@/lib/api/playlists"
import { useSession } from "@/lib/auth/client"
import { useDislikedTracks } from "@/lib/dislikes-store"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"

const CATALOG_TRACK_ID = /^\d+$/

export function TrackDislikeButton({
  trackId,
  isInLikedSongs = false,
}: {
  trackId: string
  isInLikedSongs?: boolean
}) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const userId = Number(session?.user.id)
  const effectiveUserId = Number.isFinite(userId) ? userId : 0
  const { isDisliked, setDislike } = useDislikedTracks(effectiveUserId)
  const { isLiked, setLike } = useLikedTracks(effectiveUserId)

  if (!session?.user) return null

  const disliked = isDisliked(trackId)
  const liked = isLiked(trackId) || isInLikedSongs

  const toggle = () => {
    const nextDisliked = !disliked
    setDislike(trackId, nextDisliked)

    // Se o usuário deu deslike em uma música que estava curtida, descurte
    if (nextDisliked && liked) {
      setLike(trackId, false)
      if (CATALOG_TRACK_ID.test(trackId)) {
        const musicId = Number(trackId)
        likedMusicsApi
          .unlike(musicId)
          .then(() => queryClient.invalidateQueries({ queryKey: playlistKeys.all }))
          .catch(() => {})
      }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={disliked ? "Remover deslike da faixa" : "Não curtir faixa"}
      title={disliked ? "Remover deslike" : "Não curti"}
      aria-pressed={disliked}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2",
        disliked ? "text-destructive" : "text-muted-foreground/50 hover:text-foreground"
      )}
    >
      <ThumbsDownIcon size={16} />
    </button>
  )
}

