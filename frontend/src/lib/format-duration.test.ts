import { describe, expect, it } from "bun:test"
import { formatTotalDuration, sumDurationSec } from "./format-duration"

describe("formatTotalDuration", () => {
  it("shows minutes below an hour", () => {
    expect(formatTotalDuration(23 * 60 + 10)).toBe("23 min")
  })

  it("rounds up to the hour instead of printing 60 min", () => {
    expect(formatTotalDuration(59 * 60 + 40)).toBe("1 h")
  })

  it("shows hours and minutes past an hour", () => {
    expect(formatTotalDuration(2 * 3600 + 14 * 60)).toBe("2 h 14 min")
  })

  it("is zero for an empty playlist", () => {
    expect(formatTotalDuration(sumDurationSec([]))).toBe("0 min")
  })
})

describe("sumDurationSec", () => {
  it("adds the length of every track", () => {
    expect(sumDurationSec([{ durationSec: 258 }, { durationSec: 212 }])).toBe(470)
  })
})
