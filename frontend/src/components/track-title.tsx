"use client"

import { HeadphonesIcon } from "@/components/icons"
import { useListenedMusicIds } from "@/lib/api/history"

// A small headphones when the account already listened to the music for more than 30 seconds
// in one listen (HU-15); nothing otherwise
export function ListenedMark({ musicId }: { musicId: number }) {
  const listenedMusicIds = useListenedMusicIds()
  if (!listenedMusicIds.has(musicId)) return null
  return (
    <span title="Já ouvida" className="inline-flex shrink-0 items-center text-muted-foreground">
      <HeadphonesIcon size={12} />
      <span className="sr-only">Já ouvida</span>
    </span>
  )
}

// The title line of a track in a list, with the listened mark after it. `musicId` null leaves
// the mark out (sample tracks, or a list made only of listened musics)
export function TrackTitle({ title, musicId }: { title: string; musicId: number | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-sm font-medium">{title}</span>
      {musicId !== null && <ListenedMark musicId={musicId} />}
    </span>
  )
}
