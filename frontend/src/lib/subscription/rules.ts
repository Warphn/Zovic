// Subscription rules (issue #1), as pure functions over the list of subscriptions. The simulated
// client (./client.ts) runs them in the browser; the API will run the same rules on its side, and
// then these stay only as the UI's preview of what is allowed.

export type PlanTypeId = "individual" | "familia"

export interface PlanType {
  id: PlanTypeId
  name: string
  /** Monthly price in BRL. */
  price: number
  /** Members including the owner. */
  maxMembers: number
}

// Same prices as api/prisma/seed/plan-types.ts; the family limit is the requirement's 4.
export const PLAN_TYPES: readonly PlanType[] = [
  { id: "individual", name: "Individual", price: 12.99, maxMembers: 1 },
  { id: "familia", name: "Família", price: 29.99, maxMembers: 4 },
]

export interface Member {
  name: string
  /** Lowercase; identifies the account, as the API's user.email does. */
  email: string
  /** AAAA-MM-DD. */
  birthdate: string
  isOwner: boolean
}

export interface Subscription {
  id: string
  typeId: PlanTypeId
  members: Member[]
  createdAt: string
}

/** Who is acting: the signed-in account, as the session reports it. */
export interface Account {
  name: string
  email: string
  birthdate: string | null
  isAdult: boolean
}

export type SubscriptionErrorCode =
  | "MINOR_CANNOT_SUBSCRIBE"
  | "ALREADY_SUBSCRIBED"
  | "NOT_SUBSCRIBED"
  | "NOT_OWNER"
  | "NOT_FAMILY_PLAN"
  | "PLAN_FULL"
  | "MEMBER_IN_ANOTHER_PLAN"
  | "INVALID_MEMBER"
  | "OWNER_CANNOT_LEAVE"
  | "PLAN_HAS_MEMBERS"

export class SubscriptionError extends Error {
  constructor(readonly code: SubscriptionErrorCode) {
    super(code)
  }
}

export const ADULT_AGE = 18

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Adult from the day they turn 18 (same rule as api/domain/shared/age.ts); no date counts as minor. */
export function isAdultOn(birthdate: string | null, today: string): boolean {
  if (!birthdate || !ISO_DATE.test(birthdate) || !ISO_DATE.test(today)) return false
  const year = Number(today.slice(0, 4)) - ADULT_AGE
  return birthdate <= `${String(year).padStart(4, "0")}${today.slice(4)}`
}

/** Today's date ("AAAA-MM-DD") in São Paulo, where the API decides ages too. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function planType(id: PlanTypeId): PlanType {
  return PLAN_TYPES.find((type) => type.id === id) ?? PLAN_TYPES[0]
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function findSubscriptionOf(subscriptions: readonly Subscription[], email: string): Subscription | null {
  const target = normalizeEmail(email)
  return subscriptions.find((s) => s.members.some((m) => m.email === target)) ?? null
}

function ownedBy(subscriptions: readonly Subscription[], account: Account): Subscription {
  const subscription = findSubscriptionOf(subscriptions, account.email)
  if (!subscription) throw new SubscriptionError("NOT_SUBSCRIBED")
  const me = subscription.members.find((m) => m.email === normalizeEmail(account.email))
  if (!me?.isOwner) throw new SubscriptionError("NOT_OWNER")
  return subscription
}

const replace = (subscriptions: readonly Subscription[], updated: Subscription) =>
  subscriptions.map((s) => (s.id === updated.id ? updated : s))

/** Only adults subscribe, and an account is in one subscription at most. */
export function subscribe(
  subscriptions: readonly Subscription[],
  account: Account,
  typeId: PlanTypeId,
  id: string,
  now: Date = new Date()
): Subscription[] {
  if (!account.isAdult) throw new SubscriptionError("MINOR_CANNOT_SUBSCRIBE")
  if (findSubscriptionOf(subscriptions, account.email)) throw new SubscriptionError("ALREADY_SUBSCRIBED")
  const owner: Member = {
    name: account.name,
    email: normalizeEmail(account.email),
    birthdate: account.birthdate ?? "",
    isOwner: true,
  }
  return [...subscriptions, { id, typeId, members: [owner], createdAt: now.toISOString() }]
}

/** The owner of a family plan adds someone (minors included) while there is room. */
export function addMember(
  subscriptions: readonly Subscription[],
  account: Account,
  member: Omit<Member, "isOwner">,
  today: string
): Subscription[] {
  const subscription = ownedBy(subscriptions, account)
  if (subscription.typeId !== "familia") throw new SubscriptionError("NOT_FAMILY_PLAN")
  if (subscription.members.length >= planType(subscription.typeId).maxMembers) throw new SubscriptionError("PLAN_FULL")

  const email = normalizeEmail(member.email)
  const name = member.name.trim()
  if (!name || !/^[^\s@]+@[^\s@]+$/.test(email) || !ISO_DATE.test(member.birthdate) || member.birthdate > today) {
    throw new SubscriptionError("INVALID_MEMBER")
  }
  if (findSubscriptionOf(subscriptions, email)) throw new SubscriptionError("MEMBER_IN_ANOTHER_PLAN")

  return replace(subscriptions, {
    ...subscription,
    members: [...subscription.members, { name, email, birthdate: member.birthdate, isOwner: false }],
  })
}

/** The owner removes another member; the owner only leaves by cancelling, once alone. */
export function removeMember(subscriptions: readonly Subscription[], account: Account, email: string): Subscription[] {
  const subscription = ownedBy(subscriptions, account)
  const target = normalizeEmail(email)
  const member = subscription.members.find((m) => m.email === target)
  if (!member) throw new SubscriptionError("NOT_SUBSCRIBED")
  if (member.isOwner) throw new SubscriptionError("OWNER_CANNOT_LEAVE")
  return replace(subscriptions, { ...subscription, members: subscription.members.filter((m) => m.email !== target) })
}

/** A member who is not the owner leaves the family plan. */
export function leave(subscriptions: readonly Subscription[], account: Account): Subscription[] {
  const subscription = findSubscriptionOf(subscriptions, account.email)
  if (!subscription) throw new SubscriptionError("NOT_SUBSCRIBED")
  const email = normalizeEmail(account.email)
  if (subscription.members.find((m) => m.email === email)?.isOwner) throw new SubscriptionError("OWNER_CANNOT_LEAVE")
  return replace(subscriptions, { ...subscription, members: subscription.members.filter((m) => m.email !== email) })
}

/** The owner cancels; with other members still in, they have to be removed first. */
export function cancel(subscriptions: readonly Subscription[], account: Account): Subscription[] {
  const subscription = ownedBy(subscriptions, account)
  if (subscription.members.length > 1) throw new SubscriptionError("PLAN_HAS_MEMBERS")
  return subscriptions.filter((s) => s.id !== subscription.id)
}

export const ERROR_MESSAGES: Record<SubscriptionErrorCode, string> = {
  MINOR_CANNOT_SUBSCRIBE: "Só maiores de 18 anos podem assinar. Peça para um adulto incluir você em um plano Família.",
  ALREADY_SUBSCRIBED: "Você já tem uma assinatura ativa.",
  NOT_SUBSCRIBED: "Você não tem uma assinatura ativa.",
  NOT_OWNER: "Só quem assinou o plano pode fazer isso.",
  NOT_FAMILY_PLAN: "Só o plano Família aceita outras pessoas.",
  PLAN_FULL: "O plano Família já tem 4 pessoas.",
  MEMBER_IN_ANOTHER_PLAN: "Essa pessoa já está em outra assinatura.",
  INVALID_MEMBER: "Confira o nome, o email e a data de nascimento.",
  OWNER_CANNOT_LEAVE: "Quem assinou não sai do plano: cancele a assinatura.",
  PLAN_HAS_MEMBERS: "Remova as outras pessoas do plano antes de cancelar.",
}
