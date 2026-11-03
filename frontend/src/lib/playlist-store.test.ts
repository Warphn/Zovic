import { describe, expect, it } from "bun:test"
import {
  DEFAULT_PLAYLIST_COLOR,
  INITIAL_PLAYLISTS,
  DEFAULT_TRACKS,
  getPlaylistInitials,
  musicToTrack,
  toPlaylistData,
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

  it("turns an API playlist into what the pages draw, with the default color when it has none", () => {
    const playlist = { id: 4, name: "Churrasco", isPrivate: false, createdAt: "2026-01-02T12:00:00.000Z", isAdmin: false }
    expect(toPlaylistData({ ...playlist, color: "#F2A541" })).toEqual({
      id: "4",
      name: "Churrasco",
      color: "#F2A541",
      isPrivate: false,
      createdAt: "2026-01-02T12:00:00.000Z",
      tracks: [],
      canEdit: false,
    })
    expect(toPlaylistData({ ...playlist, color: null }).color).toBe(DEFAULT_PLAYLIST_COLOR)
  })

  it("turns a playlist's musics into tracks, in the playlist's order", () => {
    const playlist = { id: 4, name: "Churrasco", isPrivate: false, color: null, createdAt: "2026-01-02T12:00:00.000Z", isAdmin: true }
    const musics = [
      { id: 9, name: "Pedra na Água", duration: 201, artists: [{ id: 3, name: "Tomás Lago" }], album: null, addedAt: "2026-01-03T00:00:00.000Z" },
      {
        id: 2,
        name: "Asfalto Molhado",
        duration: 247,
        artists: [
          { id: 1, name: "Maré Alta" },
          { id: 5, name: "Nina Sol" },
        ],
        album: { id: 1, name: "Ondas de Concreto" },
        addedAt: "2026-01-02T00:00:00.000Z",
      },
    ]

    const data = toPlaylistData(playlist, musics)

    expect(data.tracks.map((t) => t.id)).toEqual(["9", "2"])
    expect(data.tracks[1]).toEqual({
      id: "2",
      title: "Asfalto Molhado",
      artist: "Maré Alta, Nina Sol",
      album: "Ondas de Concreto",
      duration: "4:07",
      durationSec: 247,
      year: "",
    })
    // No album: the field stays empty and the covers fall back to the title
    expect(musicToTrack({ ...musics[1], album: null }).album).toBe("")
  })
})
