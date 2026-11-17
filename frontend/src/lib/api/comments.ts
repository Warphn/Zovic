import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { json, request } from "./client"

// /api/musics/:musicId/comments and /api/comments/:id (api/adapters/http/comment-controller.ts).
// Minors get an empty list and cannot comment or report: the API decides, the screen only hides the panel.

/** A comment as GET /musics/:musicId/comments lists it, newest first. */
export interface MusicComment {
  id: number
  musicId: number
  userId: number
  authorName: string
  comment: string
  /** Seconds into the music the comment points at; null when it points at none. */
  timestamp: number | null
  /** ISO date. */
  createdAt: string
  /** Written by the signed-in account: it can delete it, and cannot report it. */
  isMine: boolean
}

export interface NewComment {
  comment: string
  timestamp: number | null
}

export const commentsApi = {
  list: (musicId: number, signal?: AbortSignal) =>
    request<MusicComment[]>(`/musics/${musicId}/comments`, { signal }),
  create: (musicId: number, input: NewComment) =>
    request<Omit<MusicComment, "authorName" | "isMine">>(`/musics/${musicId}/comments`, json("POST", input)),
  remove: (commentId: number) => request<void>(`/comments/${commentId}`, { method: "DELETE" }),
  report: (commentId: number, reason: string) =>
    request<{ success: true }>(`/comments/${commentId}/reports`, json("POST", { reason })),
}

export const commentKeys = {
  all: ["comments"] as const,
  music: (musicId: number) => [...commentKeys.all, "music", musicId] as const,
}

export function useMusicComments(musicId: number) {
  return useQuery({
    queryKey: commentKeys.music(musicId),
    queryFn: ({ signal }) => commentsApi.list(musicId, signal),
  })
}

export function useCreateComment(musicId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewComment) => commentsApi.create(musicId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.music(musicId) }),
  })
}

export function useDeleteComment(musicId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: number) => commentsApi.remove(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.music(musicId) }),
  })
}

/** Reporting changes nothing on the list: the comment stays until an admin acts on it. */
export function useReportComment() {
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: number; reason: string }) => commentsApi.report(commentId, reason),
  })
}
