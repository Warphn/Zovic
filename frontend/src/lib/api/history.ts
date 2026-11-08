import { useQuery } from "@tanstack/react-query"
import { request } from "./client"

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

export const historyApi = {
  /** Each music played once, the most recently played first; empty for a new account. */
  list: (signal?: AbortSignal) => request<HistoryEntry[]>("/history", { signal }),
}

export const historyKeys = {
  all: ["history"] as const,
  list: () => [...historyKeys.all, "list"] as const,
}

export function useHistory() {
  return useQuery({ queryKey: historyKeys.list(), queryFn: ({ signal }) => historyApi.list(signal) })
}
