import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "./client"
import { playlistKeys } from "./playlists"
import { recommendationKeys } from "./recommendations"

// /api/me/disliked-musics: the dislikes of the signed-in account (HU-20, api/adapters/http/disliked-musics-controller.ts).

export const dislikesApi = {
  /** The ids of the musics the account disliked, the most recent first. */
  list: (signal?: AbortSignal) => request<number[]>("/me/disliked-musics", { signal }),
  /** Also takes the music out of "Músicas Curtidas": one vote per account and music. */
  dislike: (musicId: number) => request<void>(`/me/disliked-musics/${musicId}`, { method: "PUT" }),
  removeDislike: (musicId: number) => request<void>(`/me/disliked-musics/${musicId}`, { method: "DELETE" }),
}

export const dislikeKeys = {
  all: ["dislikes"] as const,
}

const NO_DISLIKED_MUSICS = new Set<number>()

/** The ids of the musics the account disliked; empty while loading. */
export function useDislikedMusicIds(): Set<number> {
  const { data: musicIds } = useQuery({ queryKey: dislikeKeys.all, queryFn: ({ signal }) => dislikesApi.list(signal) })
  return React.useMemo(() => (musicIds ? new Set(musicIds) : NO_DISLIKED_MUSICS), [musicIds])
}

/** Gives or takes the dislike. The recommendations leave disliked musics out, so they reload too. */
export function useSetDislike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ musicId, isDisliked }: { musicId: number; isDisliked: boolean }) =>
      isDisliked ? dislikesApi.dislike(musicId) : dislikesApi.removeDislike(musicId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dislikeKeys.all }),
        queryClient.invalidateQueries({ queryKey: playlistKeys.all }),
        queryClient.invalidateQueries({ queryKey: recommendationKeys.all }),
      ]),
  })
}
