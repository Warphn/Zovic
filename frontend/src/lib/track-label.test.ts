import { describe, expect, it } from "bun:test"
import { playButtonLabel } from "./track-label"

describe("playButtonLabel", () => {
  it("diz se a faixa vai tocar ou pausar", () => {
    expect(playButtonLabel("Coven", { isPlaying: false, isListened: false })).toBe("Tocar Coven")
    expect(playButtonLabel("Coven", { isPlaying: true, isListened: false })).toBe("Pausar Coven")
  })

  it("avisa o leitor de tela que a faixa já foi ouvida", () => {
    expect(playButtonLabel("Coven", { isPlaying: false, isListened: true })).toBe("Tocar Coven, já ouvida")
    expect(playButtonLabel("Coven", { isPlaying: true, isListened: true })).toBe("Pausar Coven, já ouvida")
  })
})
