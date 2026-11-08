import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/lib/auth/client"
import type { PlanTypeId } from "@/lib/subscription/rules"
import { ApiError, json, request } from "./client"

// /api/plans: the signed-in account's subscription (api/adapters/http/subscription-controller.ts).

export interface Subscription {
  planId: number
  kind: PlanTypeId
  /** Whether this account can cancel: the individual subscriber or the family plan's manager. */
  isManager: boolean
  /** ISO date-time. */
  startedAt: string
}

export interface PlanMember {
  id: number
  name: string
  email: string
  isManager: boolean
}

export interface PendingInvitation {
  id: number
  email: string
  /** ISO date-time. */
  expiresAt: string
}

/** The family plan as its manager sees it. A pending invitation holds a slot, so `freeSlots` already counts it. */
export interface PlanMembers {
  members: PlanMember[]
  pendingInvitations: PendingInvitation[]
  limit: number
  freeSlots: number
}

/** The invitation and its link token; the token is shown only in this answer. */
export interface CreatedInvitation {
  id: number
  email: string
  /** ISO date-time. */
  expiresAt: string
  token: string
}

/** What a public invitation link shows before anyone signs in. */
export interface InvitationPreview {
  email: string
  managerName: string
  /** ISO date-time. */
  expiresAt: string
}

export const subscriptionsApi = {
  /** The active subscription, as a subscriber or as a family plan member; null when there is none. */
  mine: (signal?: AbortSignal) => request<Subscription | null>("/plans/me", { signal }),
  /** Subscribes to a plan: payment is simulated, so it is active right away. */
  subscribe: (kind: PlanTypeId) => request<Subscription>("/plans", json("POST", { kind })),
  cancel: () => request<void>("/plans/me", { method: "DELETE" }),
  /** Family plan manager only. */
  members: (signal?: AbortSignal) => request<PlanMembers>("/plans/me/members", { signal }),
  invite: (email: string) => request<CreatedInvitation>("/plans/me/invitations", json("POST", { email })),
  cancelInvitation: (invitationId: number) =>
    request<void>(`/plans/me/invitations/${invitationId}`, { method: "DELETE" }),
  removeMember: (userId: number) => request<void>(`/plans/me/members/${userId}`, { method: "DELETE" }),
  /** A member leaves the family plan they joined. */
  leave: () => request<void>("/plans/me/membership", { method: "DELETE" }),
  /** Public: 404 means the link is invalid, expired, used or cancelled. */
  invitation: (token: string, signal?: AbortSignal) =>
    request<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, { signal }),
  acceptInvitation: (token: string) =>
    request<Subscription>(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" }),
}

export const subscriptionKeys = {
  all: ["subscription"] as const,
  mine: () => [...subscriptionKeys.all, "mine"] as const,
  members: () => [...subscriptionKeys.all, "members"] as const,
}

export const invitationKeys = {
  all: ["invitation"] as const,
  byToken: (token: string) => [...invitationKeys.all, token] as const,
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

// Accepting and leaving change what the account can open, so they reset everything too. Call them
// with mutateAsync: the reset can unmount the caller, and React Query skips the callbacks of an
// unmounted component.
export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: subscriptionsApi.acceptInvitation,
    // The invitation queries are spared: the link is now used, so refetching it would answer 404
    // and the page would show "invalid invitation" before it navigates away
    onSuccess: () => queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== invitationKeys.all[0] }),
  })
}

export function useLeavePlan() {
  const resetAllQueries = useResetAllQueries()
  return useMutation({ mutationFn: subscriptionsApi.leave, onSuccess: resetAllQueries })
}

/** The manager's view of the family plan; pass `enabled: false` for plans that have no members list. */
export function usePlanMembers(enabled: boolean) {
  return useQuery({
    queryKey: subscriptionKeys.members(),
    queryFn: ({ signal }) => subscriptionsApi.members(signal),
    enabled,
  })
}

// The manager's changes only touch the members list
function useInvalidateMembers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.members() })
}

export function useInviteToPlan() {
  const invalidateMembers = useInvalidateMembers()
  return useMutation({ mutationFn: subscriptionsApi.invite, onSuccess: invalidateMembers })
}

export function useCancelInvitation() {
  const invalidateMembers = useInvalidateMembers()
  return useMutation({ mutationFn: subscriptionsApi.cancelInvitation, onSuccess: invalidateMembers })
}

export function useRemoveMember() {
  const invalidateMembers = useInvalidateMembers()
  return useMutation({ mutationFn: subscriptionsApi.removeMember, onSuccess: invalidateMembers })
}

/** The invitation behind a link. Only a 404 ApiError means the link is invalid; other errors are failures to check. */
export function useInvitation(token: string | null) {
  return useQuery({
    queryKey: invitationKeys.byToken(token ?? ""),
    queryFn: ({ signal }) => subscriptionsApi.invitation(token ?? "", signal),
    enabled: token !== null,
  })
}

/** True for the API's 404 on an invitation: invalid, expired, used or cancelled. A network failure is not that. */
export function isInvalidInvitation(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
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
