"use client"

import { HeartIcon } from "@/components/icons"
import { useSession } from "@/lib/auth/client"
import { useLikedTracks } from "@/lib/likes-store"
import { cn } from "@/lib/utils"

export function TrackLikeButton({ trackId }: { trackId: string }) {
  const { data: session } = useSession()
  const userId = Number(session?.user.id)
  const { isLiked, toggleLike } = useLikedTracks(Number.isFinite(userId) ? userId : 0)

  if (!session?.user) return null

  const liked = isLiked(trackId)
  return (
    <button
      type="button"
      onClick={() => toggleLike(trackId)}
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