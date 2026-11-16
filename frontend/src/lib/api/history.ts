import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { json, request } from "./client"

// /api/history: what the signed-in account has played (api/adapters/http/history-controller.ts).

/** A music the account played, as GET /history lists it. */
export interface HistoryEntry {
  musicId: number
  name: string
  /** Seconds. */
  duration: number
  /** Active artists, alphabetical. */
  artists: { id: number; name: string }[]
  /** ISO date-time of the most recent play. */
  lastPlayedAt: string
  /** False when an admin removed the music: it still shows in the history but cannot be played. */
  isAvailable: boolean
}

/** A music played for more than 30 seconds in one listen (HU-15), as GET /history/listened lists it. */
export interface ListenedEntry extends Omit<HistoryEntry, "lastPlayedAt"> {
  /** ISO date-time of the most recent listen that passed 30 seconds. */
  lastListenedAt: string
}

export const historyApi = {
  /** Each music played once, the most recently played first; empty for a new account. */
  list: (signal?: AbortSignal) => request<HistoryEntry[]>("/history", { signal }),
  /** Each music listened once, the most recently listened first. */
  listListened: (signal?: AbortSignal) => request<ListenedEntry[]>("/history/listened", { signal }),
  /** Tells the API a listen passed 30 seconds of sound; it answers 409 for 30 seconds or less. */
  markListened: (musicId: number, playedSeconds: number) =>
    request<void>(`/musics/${musicId}/listens`, json("POST", { playedSeconds })),
}

export const historyKeys = {
  all: ["history"] as const,
  list: () => [...historyKeys.all, "list"] as const,
  listened: () => [...historyKeys.all, "listened"] as const,
}

export function useHistory() {
  return useQuery({ queryKey: historyKeys.list(), queryFn: ({ signal }) => historyApi.list(signal) })
}

export function useListenedMusics() {
  return useQuery({ queryKey: historyKeys.listened(), queryFn: ({ signal }) => historyApi.listListened(signal) })
}

const NO_LISTENED_MUSICS = new Set<number>()

/** The ids of the musics the account already listened to; empty while loading. */
export function useListenedMusicIds(): Set<number> {
  const { data: entries } = useListenedMusics()
  return React.useMemo(
    () => (entries ? new Set(entries.map((entry) => entry.musicId)) : NO_LISTENED_MUSICS),
    [entries]
  )
}
