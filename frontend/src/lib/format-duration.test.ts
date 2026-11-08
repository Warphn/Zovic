import { describe, expect, it } from "bun:test"
import { formatDuration, formatTotalDuration, parseDuration, sumDurationSec } from "./format-duration"

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

describe("duration helpers", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(258)).toBe("4:18")
    expect(formatDuration(61)).toBe("1:01")
    expect(formatDuration(9)).toBe("0:09")
  })

  it("parses m:ss or plain seconds", () => {
    expect(parseDuration("4:18")).toBe(258)
    expect(parseDuration(" 212 ")).toBe(212)
  })

  it("rejects empty, zero, malformed and out-of-range seconds", () => {
    for (const value of ["", "0", "0:00", "4:60", "abc", "-5", "1.5"]) {
      expect(parseDuration(value)).toBeNull()
    }
  })
})
