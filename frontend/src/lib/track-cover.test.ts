import { describe, expect, it } from "bun:test"
import type { Album, CatalogMusic } from "./api/catalog"
import { coverUrlOfTrack } from "./track-cover"

const COVER_PATH = "/api/albums/3/cover?v=1"

function music(id: number, musicAlbum: CatalogMusic["album"]): CatalogMusic {
  return {
    id,
    name: `Música ${id}`,
    duration: 180,
    artists: [],
    streams: 0,
    plays: 0,
    genres: [],
    album: musicAlbum,
    isExplicit: false,
    hasAudio: true,
    createdAt: "2026-10-01T12:00:00.000Z",
    deletedAt: null,
  }
}

function album(id: number, coverUrl: string | null): Album {
  return { id, name: `Álbum ${id}`, year: 2024, artists: [], musicCount: 1, coverUrl }
}

const IN_ALBUM_3 = { id: 3, name: "Álbum 3", year: 2024 }

describe("coverUrlOfTrack", () => {
  it("finds the cover through the music's album", () => {
    expect(coverUrlOfTrack("7", [music(7, IN_ALBUM_3)], [album(3, COVER_PATH)])).toBe(COVER_PATH)
  })

  it("sample tracks have no cover", () => {
    expect(coverUrlOfTrack("t1", [music(7, IN_ALBUM_3)], [album(3, COVER_PATH)])).toBeNull()
  })

  it("a music without album has no cover", () => {
    expect(coverUrlOfTrack("7", [music(7, null)], [album(3, COVER_PATH)])).toBeNull()
  })

  it("an album without cover has no cover", () => {
    expect(coverUrlOfTrack("7", [music(7, IN_ALBUM_3)], [album(3, null)])).toBeNull()
  })

  it("an unknown music has no cover", () => {
    expect(coverUrlOfTrack("8", [music(7, IN_ALBUM_3)], [album(3, COVER_PATH)])).toBeNull()
  })
})
