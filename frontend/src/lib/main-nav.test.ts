import { describe, expect, it } from "bun:test"
import { isNavLinkActive } from "./main-nav"

describe("isNavLinkActive", () => {
  it("marks the link of the page itself", () => {
    expect(isNavLinkActive("/inicio", "/inicio")).toBe(true)
  })

  it("marks the link on the pages under it", () => {
    expect(isNavLinkActive("/playlist", "/playlist/12")).toBe(true)
  })

  it("does not mark a link whose path only starts the same way", () => {
    expect(isNavLinkActive("/playlist", "/player")).toBe(false)
  })

  it("does not mark the link of another page", () => {
    expect(isNavLinkActive("/historico", "/inicio")).toBe(false)
  })
})
