"use client"

import * as React from "react"
import { createMockAuthClient, type KeyValueStorage, type Session } from "./mock-client"

// localStorage can be missing or throw (private mode, blocked storage): then nobody stays signed in
const browserStorage: KeyValueStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // nothing to persist into
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // nothing to remove from
    }
  },
}

export const authClient = createMockAuthClient(browserStorage)

// Same shape as BetterAuth's useSession. The server cannot see the session, so it renders
// "pending"; the client resolves it on hydration.
export function useSession(): { data: Session | null; isPending: boolean } {
  const session = React.useSyncExternalStore<Session | null | undefined>(
    authClient.subscribe,
    authClient.getSession,
    () => undefined
  )
  return { data: session ?? null, isPending: session === undefined }
}
