import { useQuery } from "@tanstack/react-query"
import { request } from "./client"

// /api/recommendations: the musics suggested to the signed-in account (api/adapters/http/recommendation-controller.ts).

/** A suggested music, as GET /recommendations lists it. */
export interface RecommendedMusic {
  id: number
  name: string
  /** Seconds. */
  duration: number
  /** Active artists, alphabetical. */
  artists: { id: number; name: string }[]
}

export const recommendationsApi = {
  /** Up to 10 musics the account has not listened to, the best match first. */
  list: (signal?: AbortSignal) => request<RecommendedMusic[]>("/recommendations", { signal }),
}

export const recommendationKeys = {
  all: ["recommendations"] as const,
}

export function useRecommendations() {
  return useQuery({ queryKey: recommendationKeys.all, queryFn: ({ signal }) => recommendationsApi.list(signal) })
}
