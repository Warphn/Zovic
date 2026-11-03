"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"
import {
  type Account,
  addMember,
  cancel,
  ERROR_MESSAGES,
  findSubscriptionOf,
  leave,
  type Member,
  type PlanTypeId,
  removeMember,
  subscribe,
  type Subscription,
  SubscriptionError,
  todayInSaoPaulo,
} from "./rules"

// Simulated subscriptions: kept in this browser's localStorage until the API has the
// /api/plans routes. Each call is async and throws a SubscriptionError, the shape the real
// client will keep, so the pages do not change when it is swapped.

const STORAGE_KEY = "zovic_subscriptions_v1"
const CHANGE_EVENT = "zovic_subscriptions_updated"
const EMPTY: Subscription[] = []

let cachedRaw: string | null = null
let cachedList: Subscription[] = EMPTY

function read(): Subscription[] {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedList
    cachedRaw = raw
    const parsed: unknown = raw ? JSON.parse(raw) : null
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    cachedList = Array.isArray(parsed) ? (parsed as Subscription[]) : EMPTY
  } catch {
    cachedList = EMPTY
  }
  return cachedList
}

function write(list: Subscription[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // storage blocked: the change lives until the page reloads
    cachedRaw = null
    cachedList = list
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribeToStore(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

async function apply(change: (list: Subscription[]) => Subscription[]): Promise<void> {
  write(change(read()))
}

export const subscriptionClient = {
  subscribe: (account: Account, typeId: PlanTypeId) => apply((list) => subscribe(list, account, typeId, crypto.randomUUID())),
  addMember: (account: Account, member: Omit<Member, "isOwner">) =>
    apply((list) => addMember(list, account, member, todayInSaoPaulo())),
  removeMember: (account: Account, email: string) => apply((list) => removeMember(list, account, email)),
  leave: (account: Account) => apply((list) => leave(list, account)),
  cancel: (account: Account) => apply((list) => cancel(list, account)),
}

export function subscriptionMessage(error: unknown): string {
  return error instanceof SubscriptionError ? ERROR_MESSAGES[error.code] : "Algo deu errado. Tente de novo."
}

export interface SubscriptionState {
  /** The signed-in account, or null for visitors. */
  account: Account | null
  subscription: Subscription | null
  /** True while the session is still loading: the subscription is not known yet. */
  isPending: boolean
}

export function useSubscription(): SubscriptionState {
  const { data: session, isPending } = useSession()
  const list = React.useSyncExternalStore(subscribeToStore, read, () => EMPTY)

  return React.useMemo(() => {
    if (!session) return { account: null, subscription: null, isPending }
    const { name, email, birthdate, isAdult } = session.user
    const account = { name, email, birthdate, isAdult }
    return { account, subscription: findSubscriptionOf(list, email), isPending }
  }, [session, list, isPending])
}
