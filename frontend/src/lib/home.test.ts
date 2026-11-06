import { describe, expect, it } from "bun:test"
import type { Album, CatalogMusic } from "./api/catalog"
import type { HistoryEntry } from "./api/history"
import {
  countByGenre,
  firstName,
  greetingFor,
  musicsOfGenre,
  newestAlbums,
  parseRouteId,
  recentlyPlayed,
  topPlayed,
  tracksOfAlbum,
} from "./home"

const REMOVED_AT = "2026-11-01T12:00:00.000Z"

function music(id: number, overrides: Partial<CatalogMusic> = {}): CatalogMusic {
  return {
    id,
    name: `Música ${id}`,
    duration: 180,
    artists: [],
    streams: 0,
    plays: 0,
    genres: [],
    album: null,
    isExplicit: false,
    hasAudio: true,
    createdAt: "2026-10-01T12:00:00.000Z",
    deletedAt: null,
    ...overrides,
  }
}

function genre(id: number) {
  return { id, name: `Gênero ${id}`, color: "#123456" }
}

function album(id: number): Album {
  return { id, name: `Álbum ${id}`, year: 2024, artists: [], musicCount: 1, coverUrl: null }
}

function historyEntry(musicId: number, isAvailable: boolean): HistoryEntry {
  return {
    musicId,
    name: `Música ${musicId}`,
    duration: 180,
    artists: [],
    lastPlayedAt: "2026-11-05T12:00:00.000Z",
    isAvailable,
  }
}

function idsOf(items: { id: number }[]) {
  return items.map((item) => item.id)
}

describe("topPlayed", () => {
  it("orders by plays, then by name", () => {
    const musics = [
      music(1, { plays: 3, name: "C" }),
      music(2, { plays: 9, name: "B" }),
      music(3, { plays: 9, name: "A" }),
    ]
    expect(idsOf(topPlayed(musics, 10))).toEqual([3, 2, 1])
  })

  it("keeps at most count and skips removed musics", () => {
    const musics = Array.from({ length: 12 }, (_value, index) => music(index + 1, { plays: 100 - index }))
    musics[0] = music(1, { plays: 1000, deletedAt: REMOVED_AT })
    const result = topPlayed(musics, 10)
    expect(result).toHaveLength(10)
    expect(idsOf(result)).not.toContain(1)
  })
})

describe("recentlyPlayed", () => {
  it("keeps the history order and skips unavailable", () => {
    const entries = [historyEntry(1, true), historyEntry(2, false), historyEntry(3, true)]
    expect(recentlyPlayed(entries, 5).map((entry) => entry.musicId)).toEqual([1, 3])
  })
})

describe("newestAlbums", () => {
  it("takes the highest ids first", () => {
    expect(idsOf(newestAlbums([album(2), album(9), album(5)], 2))).toEqual([9, 5])
  })
})

describe("musicsOfGenre", () => {
  it("keeps the genre's musics, most played first", () => {
    const musics = [
      music(1, { genres: [genre(1)], plays: 2 }),
      music(2, { genres: [genre(2)], plays: 50 }),
      music(3, { genres: [genre(2), genre(1)], plays: 8 }),
      music(4, { genres: [genre(1)], plays: 99, deletedAt: REMOVED_AT }),
    ]
    expect(idsOf(musicsOfGenre(musics, 1))).toEqual([3, 1])
  })
})

describe("tracksOfAlbum", () => {
  it("keeps the album's musics in id order", () => {
    const inAlbum = { id: 4, name: "Álbum 4", year: 2024 }
    const musics = [
      music(9, { album: inAlbum }),
      music(3, { album: inAlbum }),
      music(5, { album: { ...inAlbum, id: 5 } }),
      music(6, { album: inAlbum, deletedAt: REMOVED_AT }),
    ]
    expect(idsOf(tracksOfAlbum(musics, 4))).toEqual([3, 9])
  })
})

describe("countByGenre", () => {
  it("counts active musics per genre", () => {
    const musics = [
      music(1, { genres: [genre(1)] }),
      music(2, { genres: [genre(1), genre(2)] }),
      music(3, { genres: [genre(1)], deletedAt: REMOVED_AT }),
    ]
    expect(countByGenre(musics)).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ])
    )
  })
})

describe("greetingFor", () => {
  it("follows the hour", () => {
    expect([4, 5, 11, 12, 17, 18].map(greetingFor)).toEqual([
      "Boa noite",
      "Bom dia",
      "Bom dia",
      "Boa tarde",
      "Boa tarde",
      "Boa noite",
    ])
  })
})

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("  Ana Andrade ")).toBe("Ana")
    expect(firstName("")).toBe("")
  })
})

describe("parseRouteId", () => {
  it("accepts positive integers only", () => {
    expect(parseRouteId("7")).toBe(7)
    for (const invalid of ["abc", "0", "-1", "1.5", undefined, ["7"]]) {
      expect(parseRouteId(invalid)).toBeNull()
    }
  })
})
