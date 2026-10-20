"use client"

import * as React from "react"

export interface CommentItem {
  id: string
  trackId: string
  userId: number
  authorName: string
  comment: string
  timestamp: number | null // segundos desde o início da música (opcional)
  createdAt: string
}

export interface CommentReportItem {
  id: string
  commentId: string
  userId: number
  reason: string
  createdAt: string
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: "c-1",
    trackId: "t1", // Construção
    userId: 2,
    authorName: "Bruno Andrade",
    comment: "Esse arranjo de orquestra subindo de tom dá um arrepio!",
    timestamp: 68,
    createdAt: "Há 2 horas",
  },
  {
    id: "c-2",
    trackId: "t1",
    userId: 1,
    authorName: "Ana Andrade",
    comment: "Uma das letras mais brilhantes da MPB de todos os tempos.",
    timestamp: null, // sem sincronização
    createdAt: "Ontem",
  },
  {
    id: "c-3",
    trackId: "t1",
    userId: 3,
    authorName: "Carla Andrade",
    comment: "A polifonia nessa estrofe aqui é impecável.",
    timestamp: 142,
    createdAt: "Há 3 dias",
  },
  {
    id: "c-4",
    trackId: "t2", // Águas de Março
    userId: 1,
    authorName: "Ana Andrade",
    comment: "A química vocal dos dois nessa gravação é histórica.",
    timestamp: 35,
    createdAt: "Hoje",
  },
  {
    id: "c-5",
    trackId: "t3", // Clube da Esquina Nº 2
    userId: 2,
    authorName: "Bruno Andrade",
    comment: "Essa harmonia de violão clássico mineiro é inconfundível.",
    timestamp: null,
    createdAt: "Há 5 dias",
  },
]

const COMMENTS_STORAGE_KEY = "zovic_comments_v1"
const REPORTS_STORAGE_KEY = "zovic_comment_reports_v1"
const COMMENTS_EVENT = "zovic_comments_updated"

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(COMMENTS_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(COMMENTS_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getStoredComments(): CommentItem[] {
  if (typeof window === "undefined") return INITIAL_COMMENTS
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // fallback
  }
  return INITIAL_COMMENTS
}

function getStoredReports(): CommentReportItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fallback
  }
  return []
}

export function useComments(trackId: string, currentUserId: number, isUnderage: boolean) {
  const allComments = React.useSyncExternalStore(subscribe, getStoredComments, () => INITIAL_COMMENTS)
  const reports = React.useSyncExternalStore(subscribe, getStoredReports, () => [])

  // Se o usuário for menor de idade, NÃO visualiza comentários de terceiros nem próprios
  const trackComments = React.useMemo(() => {
    if (isUnderage) return []
    return allComments.filter((c) => c.trackId === trackId)
  }, [allComments, trackId, isUnderage])

  const addComment = React.useCallback(
    (commentText: string, timestamp: number | null, authorName: string) => {
      if (isUnderage) {
        throw new Error("Menores de idade não podem comentar.")
      }
      const trimmed = commentText.trim()
      if (!trimmed) {
        throw new Error("O comentário não pode ser vazio.")
      }
      if (trimmed.length > 280) {
        throw new Error("O comentário não pode exceder 280 caracteres.")
      }

      const newComment: CommentItem = {
        id: "c-" + Date.now(),
        trackId,
        userId: currentUserId,
        authorName,
        comment: trimmed,
        timestamp: timestamp !== null && timestamp >= 0 ? Math.round(timestamp) : null,
        createdAt: "Agora",
      }

      const updated = [newComment, ...allComments]
      try {
        localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(COMMENTS_EVENT))
      } catch {
        // ignore
      }
      return newComment
    },
    [allComments, trackId, currentUserId, isUnderage],
  )

  const deleteComment = React.useCallback(
    (commentId: string) => {
      const target = allComments.find((c) => c.id === commentId)
      if (!target) return
      if (target.userId !== currentUserId) {
        throw new Error("Você só pode apagar seus próprios comentários.")
      }

      const updated = allComments.filter((c) => c.id !== commentId)
      try {
        localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(COMMENTS_EVENT))
      } catch {
        // ignore
      }
    },
    [allComments, currentUserId],
  )

  const reportComment = React.useCallback(
    (commentId: string, reasonText: string) => {
      if (isUnderage) {
        throw new Error("Menores de idade não podem interagir com comentários.")
      }
      const target = allComments.find((c) => c.id === commentId)
      if (!target) {
        throw new Error("Comentário não encontrado.")
      }
      if (target.userId === currentUserId) {
        throw new Error("Você não pode denunciar o seu próprio comentário.")
      }
      const trimmed = reasonText.trim()
      if (!trimmed) {
        throw new Error("Informe o motivo da denúncia.")
      }
      if (trimmed.length > 280) {
        throw new Error("O motivo não pode exceder 280 caracteres.")
      }

      const already = reports.some((r) => r.commentId === commentId && r.userId === currentUserId)
      if (already) {
        throw new Error("Você já denunciou este comentário.")
      }

      const newReport: CommentReportItem = {
        id: "rep-" + Date.now(),
        commentId,
        userId: currentUserId,
        reason: trimmed,
        createdAt: new Date().toISOString(),
      }

      const updatedReports = [...reports, newReport]
      try {
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updatedReports))
        window.dispatchEvent(new Event(COMMENTS_EVENT))
      } catch {
        // ignore
      }
    },
    [allComments, reports, currentUserId, isUnderage],
  )

  return {
    comments: trackComments,
    totalCount: trackComments.length,
    addComment,
    deleteComment,
    reportComment,
  }
}

