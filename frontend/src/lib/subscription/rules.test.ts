import { describe, expect, it } from "bun:test"
import { describePlanSize, formatPlanPrice, planType } from "./rules"

describe("plan types", () => {
  it("shows the monthly price in reais", () => {
    // Intl puts a no-break space between the symbol and the number
    expect(formatPlanPrice(planType("individual").price)).toBe("R$\u00a012,99")
    expect(formatPlanPrice(planType("family").price)).toBe("R$\u00a029,99")
  })

  it("says how many people each plan holds", () => {
    expect(describePlanSize(planType("individual"))).toBe("1 pessoa")
    expect(describePlanSize(planType("family"))).toBe("Até 4 pessoas")
  })
})
