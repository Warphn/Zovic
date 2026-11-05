"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { RequireSession } from "@/components/require-session"
import { Notice } from "@/components/ui/notice"
import { useSubscription } from "@/lib/api/subscriptions"

// The catalog is for subscribers: a signed-in account without a subscription goes to /planos and
// comes back after subscribing. Platform admins pass without one, to look after the content.
// This only steers the UI: the API refuses the catalog routes to anyone without a subscription.
function SubscribersOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { account, subscription, isPending, isError } = useSubscription()
  const allowed = Boolean(subscription) || account?.role === "admin"
  const hasNoAccess = !allowed && !isPending && !isError

  React.useEffect(() => {
    if (hasNoAccess) router.replace(`/planos?next=${encodeURIComponent(pathname + window.location.search)}`)
  }, [hasNoAccess, pathname, router])

  if (allowed) return children
  if (isError) {
    return (
      <div className="min-h-screen bg-background p-8 pt-24">
        <Notice>Não foi possível verificar a sua assinatura. Recarregue a página para tentar de novo.</Notice>
      </div>
    )
  }
  return <div className="min-h-screen bg-background" />
}

export function RequireSubscription({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <SubscribersOnly>{children}</SubscribersOnly>
    </RequireSession>
  )
}
