import { describe, expect, it } from "bun:test"
import {
  type Account,
  addMember,
  cancel,
  findSubscriptionOf,
  isAdultOn,
  leave,
  removeMember,
  subscribe,
  SubscriptionError,
  type SubscriptionErrorCode,
  type Subscription,
} from "./rules"

const TODAY = "2026-11-03"
const adult: Account = { name: "Ana", email: "Ana@x.test", birthdate: "1990-01-01", isAdult: true }
const minor: Account = { name: "Heitor", email: "heitor@x.test", birthdate: "2012-05-05", isAdult: false }

function codeOf(run: () => unknown): SubscriptionErrorCode | null {
  try {
    run()
    return null
  } catch (error) {
    if (error instanceof SubscriptionError) return error.code
    throw error
  }
}

const kid = (n: number) => ({ name: `Filho ${n}`, email: `filho${n}@x.test`, birthdate: "2014-01-01" })

function family(): Subscription[] {
  return subscribe([], adult, "familia", "s1")
}

describe("isAdultOn", () => {
  it("counts as adult from the 18th birthday on", () => {
    expect(isAdultOn("2008-11-03", TODAY)).toBe(true)
    expect(isAdultOn("2008-11-04", TODAY)).toBe(false)
  })

  it("treats a missing or malformed date as minor", () => {
    expect(isAdultOn(null, TODAY)).toBe(false)
    expect(isAdultOn("03/11/1990", TODAY)).toBe(false)
  })
})

describe("subscribe", () => {
  it("makes the adult the owner, with the email in lowercase", () => {
    const [subscription] = family()
    expect(subscription?.members).toEqual([{ name: "Ana", email: "ana@x.test", birthdate: "1990-01-01", isOwner: true }])
  })

  it("refuses minors and a second subscription", () => {
    expect(codeOf(() => subscribe([], minor, "individual", "s1"))).toBe("MINOR_CANNOT_SUBSCRIBE")
    expect(codeOf(() => subscribe(family(), adult, "individual", "s2"))).toBe("ALREADY_SUBSCRIBED")
  })
})

describe("family members", () => {
  it("lets the owner add minors up to 4 people, owner included", () => {
    let subscriptions = family()
    for (const n of [1, 2, 3]) subscriptions = addMember(subscriptions, adult, kid(n), TODAY)

    expect(subscriptions[0]?.members).toHaveLength(4)
    expect(codeOf(() => addMember(subscriptions, adult, kid(4), TODAY))).toBe("PLAN_FULL")
  })

  it("refuses individual plans, non-owners, invalid data and people already subscribed", () => {
    const individual = subscribe([], adult, "individual", "s1")
    expect(codeOf(() => addMember(individual, adult, kid(1), TODAY))).toBe("NOT_FAMILY_PLAN")

    const withKid = addMember(family(), adult, kid(1), TODAY)
    const kidAccount: Account = { ...kid(1), isAdult: false }
    expect(codeOf(() => addMember(withKid, kidAccount, kid(2), TODAY))).toBe("NOT_OWNER")

    expect(codeOf(() => addMember(family(), adult, { ...kid(1), birthdate: "2030-01-01" }, TODAY))).toBe("INVALID_MEMBER")
    expect(codeOf(() => addMember(family(), adult, { ...kid(1), email: "sem-arroba" }, TODAY))).toBe("INVALID_MEMBER")

    const other: Account = { name: "Bruno", email: "bruno@x.test", birthdate: "1985-01-01", isAdult: true }
    const twoPlans = subscribe(family(), other, "individual", "s2")
    expect(codeOf(() => addMember(twoPlans, adult, { ...kid(1), email: "BRUNO@x.test" }, TODAY))).toBe("MEMBER_IN_ANOTHER_PLAN")
  })

  it("removes a member, but never the owner", () => {
    const withKid = addMember(family(), adult, kid(1), TODAY)

    expect(removeMember(withKid, adult, "filho1@x.test")[0]?.members).toHaveLength(1)
    expect(codeOf(() => removeMember(withKid, adult, "ana@x.test"))).toBe("OWNER_CANNOT_LEAVE")
  })

  it("lets a member leave, but the owner has to cancel instead", () => {
    const withKid = addMember(family(), adult, kid(1), TODAY)
    const kidAccount: Account = { ...kid(1), isAdult: false }

    expect(findSubscriptionOf(leave(withKid, kidAccount), kidAccount.email)).toBeNull()
    expect(codeOf(() => leave(withKid, adult))).toBe("OWNER_CANNOT_LEAVE")
  })
})

describe("cancel", () => {
  it("cancels only once the owner is alone in the plan", () => {
    const withKid = addMember(family(), adult, kid(1), TODAY)
    expect(codeOf(() => cancel(withKid, adult))).toBe("PLAN_HAS_MEMBERS")

    expect(cancel(family(), adult)).toEqual([])
  })
})
