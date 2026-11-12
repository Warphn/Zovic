import { describe, expect, it } from "bun:test"
import { type SearchMusic, type SearchResults, searchApi } from "@/lib/api/search"
import { DEFAULT_PLAYLIST_COLOR, musicToTrack } from "@/lib/playlist-store"
import { normalize, toSuggestions } from "./suggestions"

const CLUBE: SearchMusic = {
  id: 3,
  name: "Clube da Esquina Nº 2",
  duration: 218,
  artists: [
    { id: 7, name: "Lô Borges" },
    { id: 8, name: "Milton Nascimento" },
  ],
}

const RESULTS: SearchResults = {
  musics: [
    CLUBE,
    { id: 9, name: "O Trem Azul", duration: 245, artists: [{ id: 7, name: "Lô Borges" }] },
  ],
  artists: [{ id: 7, name: "Lô Borges", musicCount: 2 }],
  playlists: [
    { id: 12, name: "Clube do Vinil", isPrivate: false, color: "#4f46e5", musicCount: 4 },
    { id: 13, name: "Clube", isPrivate: true, color: null, musicCount: 1 },
  ],
}

describe("search suggestions from the API", () => {
  it("ignores case and accents when comparing text", () => {
    expect(normalize("Águas de MARÇO")).toBe("aguas de marco")
  })

  it("returns nothing for a blank query", () => {
    expect(toSuggestions(RESULTS, "   ")).toEqual([])
  })

  it("keeps the API order: text completions, then tracks, artists and playlists", () => {
    const kinds = toSuggestions(RESULTS, "clube").map((s) => s.kind)
    expect(kinds).toEqual(["query", "query", "track", "track", "artist", "playlist", "playlist"])
  })

  it("completes only names that start with the query and are not the query itself", () => {
    const queries = toSuggestions(RESULTS, "CLUBE").filter((s) => s.kind === "query")
    expect(queries).toEqual([
      { kind: "query", text: "Clube da Esquina Nº 2" },
      { kind: "query", text: "Clube do Vinil" },
    ])
    expect(toSuggestions(RESULTS, "clube", 1).filter((s) => s.kind === "query")).toHaveLength(1)
    expect(toSuggestions(RESULTS, "clube", 0).some((s) => s.kind === "query")).toBe(false)
  })

  it("turns a music into a track the player can queue", () => {
    expect(musicToTrack(CLUBE)).toEqual({
      id: "3",
      title: "Clube da Esquina Nº 2",
      artist: "Lô Borges, Milton Nascimento",
      album: "",
      duration: "3:38",
      durationSec: 218,
      year: "",
    })
    // The second music, whatever the query: filtering is the API's job
    const track = toSuggestions(RESULTS, "trem").filter((s) => s.kind === "track")[1]
    expect(track).toMatchObject({ id: "9", title: "O Trem Azul", artist: "Lô Borges", track: { id: "9" } })
  })

  it("maps artist and playlist counts, with a default cover color", () => {
    const suggestions = toSuggestions(RESULTS, "lo")
    expect(suggestions).toContainEqual({ kind: "artist", id: 7, name: "Lô Borges", trackCount: 2 })
    expect(suggestions).toContainEqual({
      kind: "playlist",
      id: "13",
      name: "Clube",
      color: DEFAULT_PLAYLIST_COLOR,
      trackCount: 1,
    })
  })
})

describe("search request", () => {
  it("encodes the trimmed term and the optional limit", () => {
    expect(searchApi.path("  águas de março ")).toBe("/search?q=%C3%A1guas+de+mar%C3%A7o")
    expect(searchApi.path("rock & roll", 50)).toBe("/search?q=rock+%26+roll&limit=50")
  })
})
