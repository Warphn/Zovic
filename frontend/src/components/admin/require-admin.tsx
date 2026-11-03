"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RequireSession } from "@/components/require-session"
import { useSession } from "@/lib/auth/client"

// Admin-only area: visitors go through RequireSession (to /entrar), signed-in non-admins go
// back to their playlists. Like RequireSession this only steers the UI; every /api/admin call
// is checked by the API, which answers 403 to anyone without the admin role.
function AdminOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user.role === "admin"

  React.useEffect(() => {
    if (session && !isAdmin) router.replace("/playlist")
  }, [session, isAdmin, router])

  if (!isAdmin) return <div className="min-h-screen bg-background" />
  return children
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <AdminOnly>{children}</AdminOnly>
    </RequireSession>
  )
}
