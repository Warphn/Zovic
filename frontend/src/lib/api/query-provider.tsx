"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/lib/auth/client"
import { ApiError } from "./client"

// One QueryClient per browser tab (and per request on the server), created lazily so a
// re-render never throws the cache away.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data counts as fresh for 30 s: moving between pages does not refetch everything
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx is the answer (no session, no access, not found): retrying would not change it
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  })
}

// Everything cached belongs to whoever was signed in: when the user changes (sign-out, sign-in
// as someone else), the cache goes, so nobody sees the previous person's playlists
function ClearCacheOnUserChange() {
  const queryClient = useQueryClient()
  const { data: session, isPending } = useSession()
  const userId = isPending ? undefined : (session?.user.id ?? null)
  const previous = React.useRef<string | null | undefined>(undefined)

  React.useEffect(() => {
    if (userId === undefined) return
    if (previous.current !== undefined && previous.current !== userId) queryClient.clear()
    previous.current = userId
  }, [userId, queryClient])

  return null
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient)
  return (
    <QueryClientProvider client={client}>
      <ClearCacheOnUserChange />
      {children}
    </QueryClientProvider>
  )
}
