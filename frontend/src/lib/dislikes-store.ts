"use client"

import * as React from "react"

// Descurtidas (dislikes) por perfil: { "<userId>": ["t1", "t3", ...] }
export type DislikesByUser = Record<string, string[]>

export const DISLIKES_STORAGE_KEY = "zovic_dislikes_v1"
export const DISLIKES_EVENT = "zovic_dislikes_updated"

const EMPTY_DISLIKES: DislikesByUser = {}

let cachedRaw: string | null | undefined
let cachedValue: DislikesByUser = EMPTY_DISLIKES

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(DISLIKES_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(DISLIKES_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

export function parseDislikes(raw: string): DislikesByUser {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_DISLIKES

    const result: DislikesByUser = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result[key] = value.filter((id): id is string => typeof id === "string")
      }
    }
    return result
  } catch {
    return EMPTY_DISLIKES
  }
}

export function getDislikesSnapshot(): DislikesByUser {
  if (typeof window === "undefined" && typeof localStorage === "undefined") return EMPTY_DISLIKES

  let raw: string | null = null
  try {
    raw = localStorage.getItem(DISLIKES_STORAGE_KEY)
  } catch {
    return EMPTY_DISLIKES
  }

  if (raw === cachedRaw) return cachedValue

  cachedRaw = raw
  cachedValue = raw ? parseDislikes(raw) : EMPTY_DISLIKES
  return cachedValue
}

export function resetDislikesCache(): void {
  cachedRaw = undefined
  cachedValue = EMPTY_DISLIKES
}

export function toggleStoredDislike(userId: number, trackId: string): void {
  const current = getDislikesSnapshot()
  const key = String(userId)
  const mine = current[key] ?? []
  const nextMine = mine.includes(trackId)
    ? mine.filter((id) => id !== trackId)
    : [...mine, trackId]

  try {
    localStorage.setItem(DISLIKES_STORAGE_KEY, JSON.stringify({ ...current, [key]: nextMine }))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DISLIKES_EVENT))
    }
  } catch {
    // ignore
  }
}

export function setStoredDislike(userId: number, trackId: string, disliked: boolean): void {
  const current = getDislikesSnapshot()
  const key = String(userId)
  const mine = current[key] ?? []
  const has = mine.includes(trackId)
  if (has === disliked) return

  const nextMine = disliked
    ? [...mine, trackId]
    : mine.filter((id) => id !== trackId)

  try {
    localStorage.setItem(DISLIKES_STORAGE_KEY, JSON.stringify({ ...current, [key]: nextMine }))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DISLIKES_EVENT))
    }
  } catch {
    // ignore
  }
}

const getServerSnapshot = () => EMPTY_DISLIKES

export function useDislikedTracks(userId: number) {
  const allDislikes = React.useSyncExternalStore(subscribe, getDislikesSnapshot, getServerSnapshot)

  const dislikedIds = React.useMemo(
    () => new Set(allDislikes[String(userId)] ?? []),
    [allDislikes, userId],
  )

  const isDisliked = React.useCallback((trackId: string) => dislikedIds.has(trackId), [dislikedIds])

  const toggleDislike = React.useCallback(
    (trackId: string) => toggleStoredDislike(userId, trackId),
    [userId],
  )

  const setDislike = React.useCallback(
    (trackId: string, disliked: boolean) => setStoredDislike(userId, trackId, disliked),
    [userId],
  )

  const dislikedTrackIds = React.useMemo(() => allDislikes[String(userId)] ?? [], [allDislikes, userId])

  return { isDisliked, toggleDislike, setDislike, dislikedTrackIds }
}

