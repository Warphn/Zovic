import { describe, expect, it } from "bun:test"
import { formatDayAndTime } from "./format-date-time"

describe("formatDayAndTime", () => {
  it("shows day, month and time in São Paulo time", () => {
    expect(formatDayAndTime("2026-11-05T17:32:00Z")).toBe("05/11 às 14:32")
  })

  it("moves to the previous day when São Paulo is still behind UTC", () => {
    expect(formatDayAndTime("2026-11-06T01:05:00Z")).toBe("05/11 às 22:05")
  })
})
