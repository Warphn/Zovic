import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/lib/auth/client"
import type { PlanTypeId } from "@/lib/subscription/rules"
import { request } from "./client"

// /api/plans: the signed-in account's subscription (api/adapters/http/subscription-controller.ts).

export interface Subscription {
  planId: number
  kind: PlanTypeId
  /** Whether this account can cancel: the individual subscriber or the family plan's manager. */
  isManager: boolean
  /** ISO date-time. */
  startedAt: string
}

export const subscriptionsApi = {
  /** The active subscription, as a subscriber or as a family plan member; null when there is none. */
  mine: (signal?: AbortSignal) => request<Subscription | null>("/plans/me", { signal }),
  /** Subscribes to the individual plan: payment is simulated, so it is active right away. */
  subscribe: () => request<Subscription>("/plans", { method: "POST" }),
  cancel: () => request<void>("/plans/me", { method: "DELETE" }),
}

export const subscriptionKeys = {
  all: ["subscription"] as const,
  mine: () => [...subscriptionKeys.all, "mine"] as const,
}

// The subscription decides what the API answers on the catalog, search and playlists, so a change
// resets everything: a 403 from before subscribing, or a list from before cancelling, must not stay.
function useResetAllQueries() {
  const queryClient = useQueryClient()
  return () => queryClient.resetQueries()
}

export function useSubscribe() {
  const resetAllQueries = useResetAllQueries()
  return useMutation({ mutationFn: subscriptionsApi.subscribe, onSuccess: resetAllQueries })
}

export function useCancelSubscription() {
  const resetAllQueries = useResetAllQueries()
  return useMutation({ mutationFn: subscriptionsApi.cancel, onSuccess: resetAllQueries })
}

/** The signed-in account and its subscription; the query waits for a session, since visitors have none. */
export function useSubscription() {
  const { data: session, isPending: isSessionPending } = useSession()
  const query = useQuery({
    queryKey: subscriptionKeys.mine(),
    queryFn: ({ signal }) => subscriptionsApi.mine(signal),
    enabled: Boolean(session),
  })

  return {
    /** The signed-in account, or null for visitors. */
    account: session?.user ?? null,
    subscription: query.data ?? null,
    /** True until the subscription is known: a pending or failed lookup does not mean "no subscription". */
    isPending: isSessionPending || (Boolean(session) && query.isPending),
    isError: Boolean(session) && query.isError,
  }
}
