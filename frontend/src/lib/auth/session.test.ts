import { describe, expect, it } from "bun:test"
import { toSession } from "./session"

const user = { id: "1", name: "Ana Andrade", email: "ana@zovic.dev", birthdate: "1995-03-12" }

describe("toSession", () => {
  it("keeps what the API says about role and age", () => {
    expect(toSession({ user: { ...user, role: "admin", isAdult: true } }).user).toEqual({
      ...user,
      role: "admin",
      isAdult: true,
    })
    expect(toSession({ user: { ...user, role: "assinante", isAdult: false } }).user).toMatchObject({
      role: "assinante",
      isAdult: false,
    })
  })

  // Anything the API did not clearly grant falls back to the most restricted access
  it("never assumes admin or adult from missing or odd values", () => {
    expect(toSession({ user }).user).toMatchObject({ role: "assinante", isAdult: false })
    expect(toSession({ user: { ...user, role: "root", isAdult: "true" } }).user).toMatchObject({
      role: "assinante",
      isAdult: false,
    })
  })

  it("keeps only the fields the pages use", () => {
    const session = toSession({ user: { ...user, role: "assinante", isAdult: true, deletedAt: null } })
    expect(Object.keys(session)).toEqual(["user"])
    expect(Object.keys(session.user).toSorted()).toEqual(["birthdate", "email", "id", "isAdult", "name", "role"])
  })
})
