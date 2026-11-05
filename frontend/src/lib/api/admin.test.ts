import { describe, expect, it } from "bun:test"
import { musicFormData } from "./admin"

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
