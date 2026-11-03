import { describe, expect, it } from "bun:test"
import {
  INITIAL_PLAYLISTS,
  DEFAULT_TRACKS,
  getPlaylistInitials,
  hideExplicit,
  isExplicit,
  isPlaylistDataArray,
  persistPlaylists,
  type PlaylistData,
  restoreHidden,
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

const playlist = (id: string, trackIds: string[]): PlaylistData => ({
  id,
  name: id,
  color: "#000000",
  isPrivate: false,
  createdAt: "Hoje",
  tracks: trackIds.map((trackId) => DEFAULT_TRACKS.find((t) => t.id === trackId)!),
})

describe("explicit content", () => {
  it("flags tracks by id, so copies stored before the flag existed are covered too", () => {
    const stored = { ...DEFAULT_TRACKS.find((t) => t.id === "t5")!, explicit: undefined }
    expect(isExplicit(stored)).toBe(true)
    expect(isExplicit(DEFAULT_TRACKS.find((t) => t.id === "t1")!)).toBe(false)
  })

  it("hides explicit tracks from a minor's view", () => {
    const [visible] = hideExplicit([playlist("p", ["t1", "t5", "t2"])])
    expect(visible?.tracks.map((t) => t.id)).toEqual(["t1", "t2"])
  })

  it("keeps the hidden tracks when a minor's edit is saved", () => {
    const stored = [playlist("p", ["t1", "t5", "t2"])]
    const reordered = [playlist("p", ["t2", "t1"])]
    expect(restoreHidden(reordered, stored)[0]?.tracks.map((t) => t.id)).toEqual(["t2", "t1", "t5"])
  })
})
