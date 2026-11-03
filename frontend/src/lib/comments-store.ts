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

export interface UserProfile {
  id: number
  name: string
  birthdate: string | null
  isUnderage: boolean
}

export function calculateIsUnderage(birthdate: string | null | undefined, refYear = 2026): boolean {
  if (!birthdate) return true
  const date = new Date(birthdate)
  if (Number.isNaN(date.getTime())) return true

  const now = new Date(`${refYear}-10-20T12:00:00Z`)
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
    age--
  }
  return age < 18
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const INITIAL_COMMENTS: CommentItem[] = []

const COMMENTS_STORAGE_KEY = "zovic_comments_v2"
const REPORTS_STORAGE_KEY = "zovic_comment_reports_v1"
const COMMENTS_EVENT = "zovic_comments_updated"

const EMPTY_REPORTS: CommentReportItem[] = []

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(COMMENTS_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(COMMENTS_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function createStoredReader<T>(key: string, fallback: T[]) {
  let cachedRaw: string | null | undefined
  let cachedValue: T[] = fallback

  return function read(): T[] {
    if (typeof window === "undefined") return fallback

    let raw: string | null = null
    try {
      raw = localStorage.getItem(key)
    } catch {
      return fallback
    }

    if (raw === cachedRaw) return cachedValue

    cachedRaw = raw
    cachedValue = fallback
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) cachedValue = parsed
      } catch {
        // mantém fallback
      }
    }
    return cachedValue
  }
}

const getStoredComments = createStoredReader<CommentItem>(COMMENTS_STORAGE_KEY, INITIAL_COMMENTS)
const getStoredReports = createStoredReader<CommentReportItem>(REPORTS_STORAGE_KEY, EMPTY_REPORTS)
const getServerComments = () => INITIAL_COMMENTS
const getServerReports = () => EMPTY_REPORTS

export function useComments(trackId: string, currentUserId: number, isUnderage: boolean) {
  const allComments = React.useSyncExternalStore(subscribe, getStoredComments, getServerComments)
  const reports = React.useSyncExternalStore(subscribe, getStoredReports, getServerReports)

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