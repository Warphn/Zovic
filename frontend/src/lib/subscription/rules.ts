// The plans on offer, for the screens. The subscription rules themselves live in the API
// (api/domain/use-cases); lib/api/subscriptions.ts talks to it.

export type PlanTypeId = "individual" | "family"

export interface PlanType {
  /** Same values as the API's `kind`. */
  id: PlanTypeId
  name: string
  /** Monthly price in BRL. */
  price: number
  /** How many people the plan holds, the subscriber included. */
  userAmount: number
  /** What the plan includes, as the plan cards list it. */
  perks: readonly string[]
}

// Same prices and sizes as api/prisma/seed/plan-types.ts
export const PLAN_TYPES: readonly PlanType[] = [
  {
    id: "individual",
    name: "Individual",
    price: 12.99,
    userAmount: 1,
    perks: ["1 perfil de acesso", "Todo o catálogo", "Histórico e recomendações só seus"],
  },
  {
    id: "family",
    name: "Família",
    price: 29.99,
    userAmount: 4,
    perks: [
      "Até 4 pessoas, cada uma com o próprio perfil",
      "Menores de 18 anos entram com conta infantil",
      "Quem assina gerencia quem entra e sai",
    ],
  },
]

const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** A monthly price as the screens show it: "R$ 12,99". */
export function formatPlanPrice(value: number): string {
  return price.format(value)
}

/** "1 pessoa", "Até 4 pessoas". */
export function describePlanSize(plan: PlanType): string {
  return plan.userAmount === 1 ? "1 pessoa" : `Até ${plan.userAmount} pessoas`
}

export function planType(id: PlanTypeId): PlanType {
  return PLAN_TYPES.find((type) => type.id === id) ?? PLAN_TYPES[0]
}
