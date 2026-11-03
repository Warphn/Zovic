"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { RequireSession } from "@/components/require-session"
import { useSubscription } from "@/lib/subscription/client"
import { useSession } from "@/lib/auth/client"

// The catalog is for subscribers: a signed-in account without a subscription goes to /planos and
// comes back after subscribing. Platform admins pass without one, to look after the content.
function SubscribersOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { subscription } = useSubscription()
  const allowed = Boolean(subscription) || session?.user.role === "admin"

  React.useEffect(() => {
    if (session && !allowed) router.replace(`/planos?next=${encodeURIComponent(pathname + window.location.search)}`)
  }, [session, allowed, pathname, router])

  if (!allowed) return <div className="min-h-screen bg-background" />
  return children
}

export function RequireSubscription({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <SubscribersOnly>{children}</SubscribersOnly>
    </RequireSession>
  )
}
