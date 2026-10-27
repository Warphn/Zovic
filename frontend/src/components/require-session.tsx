"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client"

// Signed-in-only area: visitors go to /entrar and come back after login.
// This only steers the UI. What protects the data is the API, which checks the session cookie
// on every request. The check stays client-side because the cookie belongs to the API's host:
// in production (api.<domain>) the Next server never sees it, so a proxy.ts could not read it.
export function RequireSession({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = useSession()

  React.useEffect(() => {
    if (!isPending && !session) {
      const next = pathname + window.location.search
      router.replace(`/entrar?next=${encodeURIComponent(next)}`)
    }
  }, [isPending, session, pathname, router])

  if (!session) return <div className="min-h-screen bg-background" />
  return children
}
