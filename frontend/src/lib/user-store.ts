"use client"

import * as React from "react"

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

const DEFAULT_USER: UserProfile = {
  id: 1,
  name: "Ana Andrade (Maior de 18)",
  birthdate: "1995-03-12",
  isUnderage: false,
}

export const AVAILABLE_USERS: UserProfile[] = [
  DEFAULT_USER,
  {
    id: 2,
    name: "Bruno Andrade (Maior de 18)",
    birthdate: "1992-07-30",
    isUnderage: false,
  },
  {
    id: 8,
    name: "Heitor Costa (Menor - 16 anos)",
    birthdate: "2010-06-28",
    isUnderage: true,
  },
  {
    id: 9,
    name: "Isabela Costa (Menor - 14 anos)",
    birthdate: "2012-01-17",
    isUnderage: true,
  },
  {
    id: 99,
    name: "Usuário Sem Data (Tratado como Menor)",
    birthdate: null,
    isUnderage: true,
  },
]

const STORAGE_KEY = "zovic_active_user_v1"
const USER_CHANGE_EVENT = "zovic_user_changed"

let cachedUserId = DEFAULT_USER.id

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(USER_CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(USER_CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getSnapshot(): number {
  if (typeof window === "undefined") return DEFAULT_USER.id
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsedId = Number(raw)
      if (AVAILABLE_USERS.some((u) => u.id === parsedId)) {
        cachedUserId = parsedId
        return cachedUserId
      }
    }
  } catch {
    // fallback
  }
  return cachedUserId
}

export function setActiveUserId(userId: number) {
  if (typeof window === "undefined") return
  cachedUserId = userId
  try {
    localStorage.setItem(STORAGE_KEY, String(userId))
    window.dispatchEvent(new Event(USER_CHANGE_EVENT))
  } catch {
    // ignore
  }
}

export function useActiveUser(): {
  user: UserProfile
  setUser: (user: UserProfile) => void
  users: UserProfile[]
} {
  const activeId = React.useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_USER.id)
  const user = AVAILABLE_USERS.find((u) => u.id === activeId) ?? DEFAULT_USER

  const setUser = React.useCallback((newUser: UserProfile) => {
    setActiveUserId(newUser.id)
  }, [])

  return { user, setUser, users: AVAILABLE_USERS }
}

