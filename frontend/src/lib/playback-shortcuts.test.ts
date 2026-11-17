import { describe, expect, it } from "bun:test"
import { PLAYER_PATH, type ShortcutContext, togglesPlayback } from "./playback-shortcuts"

const ON_A_PAGE: ShortcutContext = { isTyping: false, isActivatable: false, pathname: "/inicio", hasPlayback: true }
const ON_THE_PLAYER: ShortcutContext = { ...ON_A_PAGE, pathname: PLAYER_PATH }

describe("togglesPlayback", () => {
  it("Space plays or pauses on any page", () => {
    expect(togglesPlayback(" ", ON_A_PAGE)).toBe(true)
    expect(togglesPlayback(" ", ON_THE_PLAYER)).toBe(true)
  })

  it("Space plays or pauses even with a button focused", () => {
    expect(togglesPlayback(" ", { ...ON_A_PAGE, isActivatable: true })).toBe(true)
  })

  it("Enter plays or pauses only on the player", () => {
    expect(togglesPlayback("Enter", ON_THE_PLAYER)).toBe(true)
    expect(togglesPlayback("Enter", ON_A_PAGE)).toBe(false)
  })

  it("Enter on a focused button or link activates it instead", () => {
    expect(togglesPlayback("Enter", { ...ON_THE_PLAYER, isActivatable: true })).toBe(false)
  })

  it("no key does it while typing", () => {
    expect(togglesPlayback(" ", { ...ON_A_PAGE, isTyping: true })).toBe(false)
    expect(togglesPlayback("Enter", { ...ON_THE_PLAYER, isTyping: true })).toBe(false)
  })

  it("no key does it with nothing in the queue", () => {
    expect(togglesPlayback(" ", { ...ON_A_PAGE, hasPlayback: false })).toBe(false)
  })

  it("other keys do nothing", () => {
    expect(togglesPlayback("k", ON_THE_PLAYER)).toBe(false)
  })
})
