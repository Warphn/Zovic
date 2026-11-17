"use client"

import type * as React from "react"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { useListenedMusicIds } from "@/lib/api/history"
import { playButtonLabel } from "@/lib/track-label"

// A track row: the row plays or pauses it; next to it, the actions on the track (queue, playlist).
// `musicId` is the catalog music, for the "já ouvida" mark in the button's name (HU-15)
export function TrackRow({
  musicId,
  isPlaying,
  onClick,
  title,
  actions,
  children,
}: {
  musicId: number | null
  isPlaying: boolean
  onClick: () => void
  title: string
  actions: React.ReactNode
  children: React.ReactNode
}) {
  const listenedMusicIds = useListenedMusicIds()
  const isListened = musicId !== null && listenedMusicIds.has(musicId)
  return (
    <div className="group flex items-center gap-1 rounded-xl pr-2 transition-colors hover:bg-muted/25">
      <button
        type="button"
        // Still drags the row in a SortableList (a playlist's tracks)
        data-row-action
        onClick={onClick}
        aria-label={playButtonLabel(title, { isPlaying, isListened })}
        aria-pressed={isPlaying}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <span className="min-w-0 flex-1">{children}</span>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            isPlaying ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </span>
      </button>
      {actions}
    </div>
  )
}
