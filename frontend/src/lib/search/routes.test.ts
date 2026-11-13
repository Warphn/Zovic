import { describe, expect, it } from "bun:test"
import { suggestionHref } from "./routes"

describe("suggestionHref", () => {
  it("opens the artist page for an artist (HU-10)", () => {
    expect(suggestionHref({ kind: "artist", id: 7, name: "Lô Borges", trackCount: 2 })).toBe("/artista/7")
  })

  it("opens the album page for an album (HU-12)", () => {
    expect(
      suggestionHref({ kind: "album", id: 21, name: "Clube da Esquina", subtitle: "Lô Borges · 1972", coverUrl: null })
    ).toBe("/album/21")
  })

  it("opens the results page for a text completion", () => {
    expect(suggestionHref({ kind: "query", text: "Clube da Esquina" })).toBe("/busca?q=Clube%20da%20Esquina")
  })
})
