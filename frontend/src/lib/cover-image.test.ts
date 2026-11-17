import { describe, expect, it } from "bun:test"
import { coverSizeError, MAX_COVER_BYTES } from "./cover-image"

const fileOf = (size: number) => new File([new Uint8Array(size)], "capa.png", { type: "image/png" })

describe("coverSizeError", () => {
  it("aceita uma imagem de exatamente 2 MB", () => {
    expect(coverSizeError(fileOf(MAX_COVER_BYTES))).toBeNull()
  })

  it("recusa uma imagem acima de 2 MB", () => {
    expect(coverSizeError(fileOf(MAX_COVER_BYTES + 1))).toBe("A imagem pode ter no máximo 2 MB.")
  })
})
