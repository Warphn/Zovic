"use client"

import { CommentIcon } from "@/components/comments/comment-icon"
import { useCommentsPanel } from "@/components/comments/comments-panel"
import { useSession } from "@/lib/auth/client"
import type { Track } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

/**
 * Botão de comentários de uma linha de faixa: abre o painel de comentários compartilhado.
 * `onPlay` é opcional: quando a lista tem uma fila própria (a playlist), passe como tocar a faixa
 * nela; sem isso, o painel toca a faixa avulsa.
 */
export function TrackCommentsButton({ track, onPlay }: { track: Track; onPlay?: () => void }) {
  const { data: session } = useSession()
  const { openTrackId, openComments } = useCommentsPanel()

  // Comentários são só para maiores de 18 anos
  if (!session?.user.isAdult) return null

  const isOpen = openTrackId === track.id
  return (
    <button
      type="button"
      onClick={() => openComments(track, onPlay)}
      aria-label={`Comentários de ${track.title}`}
      aria-pressed={isOpen}
      title="Comentários desta faixa"
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2",
        isOpen ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
      )}
    >
      <CommentIcon size={16} />
    </button>
  )
}