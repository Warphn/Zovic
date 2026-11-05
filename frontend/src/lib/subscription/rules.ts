// The plans on offer, for the screens. The subscription rules themselves live in the API
// (api/domain/use-cases); lib/api/subscriptions.ts talks to it.

export type PlanTypeId = "individual" | "family"

export interface PlanType {
  /** Same values as the API's `kind`. */
  id: PlanTypeId
  name: string
  /** Monthly price in BRL. */
  price: number
}

// Same prices as api/prisma/seed/plan-types.ts
export const PLAN_TYPES: readonly PlanType[] = [
  { id: "individual", name: "Individual", price: 12.99 },
  { id: "family", name: "Família", price: 29.99 },
]

export function planType(id: PlanTypeId): PlanType {
  return PLAN_TYPES.find((type) => type.id === id) ?? PLAN_TYPES[0]
}
