"use client"

import { ThumbsDownIcon } from "@/components/icons"
import { useDislikedMusicIds, useSetDislike } from "@/lib/api/dislikes"
import { useSession } from "@/lib/auth/client"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"

// Catalog tracks have the music's numeric id; the landing's sample tracks have none
const CATALOG_TRACK_ID = /^\d+$/

// The dislike lives in the API (HU-20), which also takes the like away: one vote per account and music
export function TrackDislikeButton({ trackId }: { trackId: string }) {
  const { data: session } = useSession()
  const userId = Number(session?.user.id)
  const { setLike } = useLikedTracks(Number.isFinite(userId) ? userId : 0)
  const dislikedMusicIds = useDislikedMusicIds()
  const setDislike = useSetDislike()

  if (!session?.user || !CATALOG_TRACK_ID.test(trackId)) return null

  const musicId = Number(trackId)
  const disliked = dislikedMusicIds.has(musicId)

  const toggle = () => {
    const nextDisliked = !disliked
    // The heart still lives in this browser, so it follows the vote the API keeps
    if (nextDisliked) setLike(trackId, false)
    setDislike.mutate({ musicId, isDisliked: nextDisliked })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={setDislike.isPending}
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
