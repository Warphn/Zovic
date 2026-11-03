import { describe, expect, it } from "bun:test"
import { formatDuration, parseDuration } from "./api"

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
