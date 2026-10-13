import { describe, expect, it } from "bun:test"
import {
  INITIAL_PLAYLISTS,
  DEFAULT_TRACKS,
  getPlaylistInitials,
  isPlaylistDataArray,
  persistPlaylists,
} from "./playlist-store"

describe("playlist-store", () => {
  it("initializes with non-empty default playlists", () => {
    expect(INITIAL_PLAYLISTS.length).toBeGreaterThan(0)
    expect(DEFAULT_TRACKS.length).toBeGreaterThan(0)
  })

  it("extracts correct monogram initials from playlist names", () => {
    expect(getPlaylistInitials("MPB de Domingo")).toBe("MD")
    expect(getPlaylistInitials("Tropicália")).toBe("TR")
    expect(getPlaylistInitials("")).toBe("Z")
    expect(getPlaylistInitials("   ")).toBe("Z")
    expect(getPlaylistInitials("Solo")).toBe("SO")
  })

  it("validates playlist data array correctly", () => {
    expect(isPlaylistDataArray(INITIAL_PLAYLISTS)).toBe(true)
    expect(isPlaylistDataArray([])).toBe(true)
    expect(isPlaylistDataArray(null)).toBe(false)
    expect(isPlaylistDataArray([{ name: "test" }])).toBe(false)
    expect(
      isPlaylistDataArray([
        {
          id: "1",
          name: "Test",
          color: "#000",
          isPrivate: false,
          createdAt: "today",
          tracks: [],
        },
      ])
    ).toBe(true)
  })

  it("safely handles persistPlaylists in non-browser environments", () => {
    expect(() => persistPlaylists(INITIAL_PLAYLISTS)).not.toThrow()
  })
})
