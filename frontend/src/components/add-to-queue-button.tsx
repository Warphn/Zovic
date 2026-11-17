"use client"

import { QueueIcon } from "@/components/icons"
import { TRACK_ACTION_CLASSES } from "@/components/track-action"
import { addToQueue } from "@/lib/playback-store"
import type { Track } from "@/lib/playlist-store"

// "Adicionar à fila" for one music: it goes to the end of the queue, which lives in the browser
// (HU-14). The outcome is reported through `onResult`, for the page to announce.
export function AddToQueueButton({
  track,
  onResult,
}: {
  track: Track
  onResult: (message: string, ok: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        addToQueue(track)
        onResult(`“${track.title}” entrou na fila`, true)
      }}
      aria-label={`Adicionar ${track.title} à fila`}
      title="Adicionar à fila"
      className={TRACK_ACTION_CLASSES}
    >
      {/* Mirrored like the bar's queue button, so the stack trails to the right */}
      <QueueIcon size={16} className="-scale-x-100" />
    </button>
  )
}
