import { describe, expect, it } from "bun:test"
import { durationFromSeconds } from "./audio-duration"

describe("durationFromSeconds", () => {
  it("rounds the duration read from the file to whole seconds", () => {
    expect(durationFromSeconds(213.6)).toBe(214)
    expect(durationFromSeconds(213.4)).toBe(213)
  })

  it("keeps a very short file at one second, since the API needs a positive duration", () => {
    expect(durationFromSeconds(0.4)).toBe(1)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -3])("gives null for %p, which the browser reports when it cannot read the file", (seconds) => {
    expect(durationFromSeconds(seconds)).toBeNull()
  })
})
