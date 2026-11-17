import { describe, expect, it } from "bun:test"
import { ALBUM_COVER_COLORS, albumCover } from "./album-cover"

describe("albumCover", () => {
  it("uses the initials of the first and last words", () => {
    expect(albumCover({ id: 1, name: "Ondas de Concreto" }).initials).toBe("OC")
    expect(albumCover({ id: 1, name: "  álbum   único " }).initials).toBe("ÁÚ")
  })

  it("uses the first two letters of a one-word name", () => {
    expect(albumCover({ id: 1, name: "Varanda" }).initials).toBe("VA")
  })

  it("gives the same album the same color every time, from the cover palette", () => {
    const first = albumCover({ id: 7, name: "Solstício" })
    expect(albumCover({ id: 7, name: "Solstício" }).color).toBe(first.color)
    expect(ALBUM_COVER_COLORS).toContain(first.color)
  })

  it("spreads neighboring albums over different colors", () => {
    expect(albumCover({ id: 1, name: "A" }).color).not.toBe(albumCover({ id: 2, name: "A" }).color)
  })
})
