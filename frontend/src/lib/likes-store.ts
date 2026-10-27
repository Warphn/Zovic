"use client"

import * as React from "react"

// Curtidas por perfil: { "<userId>": ["t1", "t3", ...] }
type LikesByUser = Record<string, string[]>

const LIKES_STORAGE_KEY = "zovic_likes_v1"
const LIKES_EVENT = "zovic_likes_updated"

const EMPTY_LIKES: LikesByUser = {}

// Cache pelo texto bruto do localStorage: o snapshot só muda de referência
// quando os dados mudam (exigência do useSyncExternalStore).
let cachedRaw: string | null | undefined
let cachedValue: LikesByUser = EMPTY_LIKES

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(LIKES_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(LIKES_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function parseLikes(raw: string): LikesByUser {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_LIKES

    const result: LikesByUser = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result[key] = value.filter((id): id is string => typeof id === "string")
      }
    }
    return result
  } catch {
    return EMPTY_LIKES
  }
}

function getSnapshot(): LikesByUser {
  if (typeof window === "undefined") return EMPTY_LIKES

  let raw: string | null = null
  try {
    raw = localStorage.getItem(LIKES_STORAGE_KEY)
  } catch {
    return EMPTY_LIKES
  }

  if (raw === cachedRaw) return cachedValue

  cachedRaw = raw
  cachedValue = raw ? parseLikes(raw) : EMPTY_LIKES
  return cachedValue
}

const getServerSnapshot = () => EMPTY_LIKES

export function useLikedTracks(userId: number) {
  const allLikes = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const likedIds = React.useMemo(
    () => new Set(allLikes[String(userId)] ?? []),
    [allLikes, userId],
  )

  const isLiked = React.useCallback((trackId: string) => likedIds.has(trackId), [likedIds])

  const toggleLike = React.useCallback(
    (trackId: string) => {
      const current = getSnapshot()
      const key = String(userId)
      const mine = current[key] ?? []
      const nextMine = mine.includes(trackId)
        ? mine.filter((id) => id !== trackId)
        : [...mine, trackId]

      try {
        localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify({ ...current, [key]: nextMine }))
        window.dispatchEvent(new Event(LIKES_EVENT))
      } catch {
        // ignore
      }
    },
    [userId],
  )

  return { isLiked, toggleLike }
}