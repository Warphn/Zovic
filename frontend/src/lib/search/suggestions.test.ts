import { describe, expect, it } from "bun:test"
import type { PlaylistData, Track } from "@/lib/playlist-store"
import { getSuggestions, normalize } from "./suggestions"

const track = (id: string, title: string, artist: string): Track => ({
  id,
  title,
  artist,
  album: "Álbum",
  duration: "3:00",
  durationSec: 180,
  year: "1972",
})

const PLAYLISTS: PlaylistData[] = [
  {
    id: "pl-1",
    name: "MPB dos Anos Dourados",
    color: "#d33a2c",
    isPrivate: false,
    createdAt: "Hoje",
    tracks: [
      track("t1", "Construção", "Chico Buarque"),
      track("t2", "Águas de Março", "Elis Regina, Tom Jobim"),
      track("t3", "Clube da Esquina Nº 2", "Milton Nascimento, Lô Borges"),
    ],
  },
  {
    id: "pl-2",
    name: "Clube do Vinil",
    color: "#4f46e5",
    isPrivate: false,
    createdAt: "Hoje",
    tracks: [track("t2", "Águas de Março", "Elis Regina, Tom Jobim"), track("t4", "Tudo o Que Você Podia Ser", "Lô Borges")],
  },
]

describe("search suggestions", () => {
  it("ignores case and accents", () => {
    expect(normalize("Águas de MARÇO")).toBe("aguas de marco")
    const kinds = getSuggestions("aguas", PLAYLISTS).map((s) => s.kind)
    expect(kinds).toContain("track")
  })

  it("returns nothing for an empty query", () => {
    expect(getSuggestions("   ", PLAYLISTS)).toEqual([])
  })

  it("groups text completions, tracks, artists and playlists, in that order", () => {
    const suggestions = getSuggestions("clube", PLAYLISTS)
    const kinds = suggestions.map((s) => s.kind)
    expect(kinds).toEqual(["query", "query", "track", "playlist"])
    expect(suggestions.slice(0, 2)).toEqual([
      { kind: "query", text: "Clube da Esquina Nº 2" },
      { kind: "query", text: "Clube do Vinil" },
    ])
  })

  it("lists each track once, linking to the first playlist that has it", () => {
    const tracks = getSuggestions("marco", PLAYLISTS).filter((s) => s.kind === "track")
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({ id: "t2", playlistId: "pl-1" })
  })

  it("splits multi-artist credits into separate artists", () => {
    const artists = getSuggestions("lo bor", PLAYLISTS).filter((s) => s.kind === "artist")
    expect(artists).toEqual([{ kind: "artist", name: "Lô Borges", trackCount: 2 }])
  })

  it("ranks word-prefix matches before matches in the middle of a word", () => {
    const tracks = getSuggestions("o", PLAYLISTS, { tracks: 10 }).filter((s) => s.kind === "track")
    // "Tudo o Que..." has a word starting with "o"; "Construção" only contains it
    expect(tracks[0]).toMatchObject({ id: "t4" })
  })

  it("caps every group", () => {
    const suggestions = getSuggestions("a", PLAYLISTS, { queries: 1, tracks: 1, artists: 1, playlists: 1 })
    const count = (kind: string) => suggestions.filter((s) => s.kind === kind).length
    expect([count("query"), count("track"), count("artist"), count("playlist")]).toEqual([1, 1, 1, 1])
  })
})
