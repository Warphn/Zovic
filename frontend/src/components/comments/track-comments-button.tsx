"use client"

import { CommentIcon } from "@/components/icons"
import { TRACK_ACTION_CLASSES } from "@/components/track-action"
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
        TRACK_ACTION_CLASSES,
        isOpen && "bg-muted/40 text-primary hover:text-primary"
      )}
    >
      <CommentIcon size={16} />
    </button>
  )
}