"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client"

// Signed-in-only area: visitors go to /entrar and come back after login.
// Client-side only while auth is a browser mock: with the real API this becomes a proxy.ts
// cookie check plus validation on the server.
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
