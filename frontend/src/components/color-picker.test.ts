import { describe, expect, it } from "bun:test"
import { PRESET_COLORS, getContrastTextColor } from "./color-picker"

describe("ColorPicker and Spotify Background logic", () => {
  it("determines correct high-contrast text color based on luminance", () => {
    // Very bright colors should have black text
    expect(getContrastTextColor("#ffffff")).toBe("text-black")
    expect(getContrastTextColor("#f59e0b")).toBe("text-black")
    expect(getContrastTextColor("#84cc16")).toBe("text-black")

    // Dark / saturated colors should have white text
    expect(getContrastTextColor("#000000")).toBe("text-white")
    expect(getContrastTextColor("#121212")).toBe("text-white") // Spotify background
    expect(getContrastTextColor("#1e7f82")).toBe("text-white")
    expect(getContrastTextColor("#d33a2c")).toBe("text-white")
    expect(getContrastTextColor("#334155")).toBe("text-white")
    expect(getContrastTextColor("#991b1b")).toBe("text-white")
    expect(getContrastTextColor("#4f46e5")).toBe("text-white")
  })

  it("contains valid hex codes for all preset colors", () => {
    expect(PRESET_COLORS.length).toBeGreaterThanOrEqual(10)

    const hexRegex = /^#[0-9a-fA-F]{6}$/
    for (const preset of PRESET_COLORS) {
      expect(preset.mood.trim().length).toBeGreaterThan(0)
      expect(preset.color).toMatch(hexRegex)
    }
  })

  it("contains unique color presets", () => {
    const colors = PRESET_COLORS.map((p) => p.color.toLowerCase())
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(colors.length)
  })

  it("handles invalid or short hex strings gracefully", () => {
    expect(getContrastTextColor("")).toBe("text-white")
    expect(getContrastTextColor("#12")).toBe("text-white")
    expect(getContrastTextColor("invalid")).toBe("text-white")
  })
})
