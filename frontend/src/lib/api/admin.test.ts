import { describe, expect, it } from "bun:test"
import { albumChanges, type MusicInput, musicChanges, musicFormData } from "./admin"
import type { Album, CatalogMusic } from "./catalog"

describe("musicFormData", () => {
  it("puts the fields as JSON in the data part and the file in the audio part", async () => {
    const audio = new File([new Uint8Array([0x49, 0x44, 0x33])], "faixa.mp3", { type: "audio/mpeg" })

    const form = musicFormData({ name: "Ressaca", duration: 214, artistIds: [1], genreIds: [2], albumId: 3, isExplicit: true, audio })

    const data = form.get("data")
    if (typeof data !== "string") throw new Error("data part should be text")
    expect(JSON.parse(data)).toEqual({
      name: "Ressaca",
      duration: 214,
      artistIds: [1],
      genreIds: [2],
      albumId: 3,
      isExplicit: true,
    })
    const sentFile = form.get("audio")
    if (!(sentFile instanceof File)) throw new Error("audio part should be a file")
    expect(sentFile.name).toBe("faixa.mp3")
  })
})

// Artist 9 was removed: the API still lists it in the credits, but the pickers only show active ones
const ACTIVE_ARTISTS = [1, 2]

const music: CatalogMusic = {
  id: 5,
  name: "Ressaca",
  duration: 214,
  artists: [
    { id: 1, name: "Maré Alta" },
    { id: 9, name: "Removido" },
  ],
  streams: 0,
  plays: 0,
  genres: [{ id: 2, name: "Rock", color: "#d33a2c" }],
  // Its album was removed, so the list shows none (the link stays in the database)
  album: null,
  isExplicit: false,
  hasAudio: true,
  createdAt: "2026-11-05T12:00:00.000Z",
  deletedAt: null,
}

const unchangedMusic: MusicInput = { name: "Ressaca", duration: 214, artistIds: [9, 1], genreIds: [2], albumId: null, isExplicit: false }

describe("musicChanges", () => {
  it("sends nothing when nothing changed, whatever the order of the ids", () => {
    expect(musicChanges(music, unchangedMusic, ACTIVE_ARTISTS)).toEqual({})
  })

  it("sends only the name when only the name changed, keeping the album link", () => {
    expect(musicChanges(music, { ...unchangedMusic, name: "Ressaca 2" }, ACTIVE_ARTISTS)).toEqual({ name: "Ressaca 2" })
  })

  it("sends albumId null only when the admin took the music out of its album", () => {
    const inAlbum = { ...music, album: { id: 3, name: "Ondas", year: 2018 } }
    expect(musicChanges(inAlbum, { ...unchangedMusic, albumId: 3 }, ACTIVE_ARTISTS)).toEqual({})
    expect(musicChanges(inAlbum, { ...unchangedMusic, albumId: null }, ACTIVE_ARTISTS)).toEqual({ albumId: null })
  })

  it("sends the new artists without the removed one, which the picker cannot show", () => {
    expect(musicChanges(music, { ...unchangedMusic, artistIds: [1, 9, 2] }, ACTIVE_ARTISTS)).toEqual({ artistIds: [1, 2] })
  })
})

describe("albumChanges", () => {
  const album: Album = {
    id: 3,
    name: "Ondas",
    year: 2018,
    artists: [
      { id: 1, name: "Maré Alta" },
      { id: 9, name: "Removido" },
    ],
  }

  it("sends only the year when only the year changed", () => {
    expect(albumChanges(album, { name: "Ondas", artistIds: [9, 1], year: 2019 }, ACTIVE_ARTISTS)).toEqual({ year: 2019 })
  })

  it("sends the new artists without the removed one", () => {
    expect(albumChanges(album, { name: "Ondas", artistIds: [1, 9, 2], year: 2018 }, ACTIVE_ARTISTS)).toEqual({ artistIds: [1, 2] })
  })
})
