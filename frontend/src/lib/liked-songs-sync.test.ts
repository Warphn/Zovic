import { describe, expect, it } from "bun:test"
import { musicIdsToSync } from "./liked-songs-sync"

describe("musicIdsToSync", () => {
  it("leva os corações do catálogo, do mais antigo para o mais novo, para o mais novo ficar no topo", () => {
    expect(musicIdsToSync(["7", "3", "12"])).toEqual([7, 3, 12])
  })

  it("deixa de fora as faixas de exemplo da landing e os ids inválidos", () => {
    expect(musicIdsToSync(["sample-1", "4", "0", "", "abc"])).toEqual([4])
  })
})
