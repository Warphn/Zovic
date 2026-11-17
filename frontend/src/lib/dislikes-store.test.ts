import { beforeEach, describe, expect, it } from "bun:test"
import {
  DISLIKES_STORAGE_KEY,
  getDislikesSnapshot,
  parseDislikes,
  resetDislikesCache,
  setStoredDislike,
  toggleStoredDislike,
} from "./dislikes-store.ts"

describe("dislikes-store", () => {
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}
    resetDislikesCache()
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      },
      key: () => null,
      length: 0,
    }
  })

  describe("parseDislikes", () => {
    it("faz parse de JSON válido com múltiplos usuários", () => {
      const raw = JSON.stringify({
        "1": ["track-1", "track-2"],
        "2": ["track-3"],
      })
      const result = parseDislikes(raw)
      expect(result).toEqual({
        "1": ["track-1", "track-2"],
        "2": ["track-3"],
      })
    })

    it("retorna vazio se o JSON for inválido ou não for objeto", () => {
      expect(parseDislikes("invalid json")).toEqual({})
      expect(parseDislikes("")).toEqual({})
      expect(parseDislikes("[1, 2, 3]")).toEqual({})
      expect(parseDislikes("null")).toEqual({})
    })

    it("filtra itens que não são strings", () => {
      const raw = JSON.stringify({
        "1": ["track-1", 123, null, "track-2"],
      })
      expect(parseDislikes(raw)).toEqual({
        "1": ["track-1", "track-2"],
      })
    })
  })

  describe("toggleStoredDislike e setStoredDislike", () => {
    it("adiciona e remove dislike alternando via toggle", () => {
      toggleStoredDislike(1, "track-10")
      expect(getDislikesSnapshot()["1"]).toEqual(["track-10"])

      toggleStoredDislike(1, "track-10")
      expect(getDislikesSnapshot()["1"]).toEqual([])
    })

    it("persiste deslikes de forma isolada por usuário", () => {
      setStoredDislike(1, "track-A", true)
      setStoredDislike(2, "track-B", true)

      const snapshot = getDislikesSnapshot()
      expect(snapshot["1"]).toEqual(["track-A"])
      expect(snapshot["2"]).toEqual(["track-B"])
      expect(snapshot["1"]).not.toContain("track-B")
      expect(snapshot["2"]).not.toContain("track-A")

      const storedInLocalStorage = JSON.parse(mockStorage[DISLIKES_STORAGE_KEY])
      expect(storedInLocalStorage["1"]).toEqual(["track-A"])
      expect(storedInLocalStorage["2"]).toEqual(["track-B"])
    })

    it("setStoredDislike é idempotente", () => {
      setStoredDislike(1, "track-1", true)
      setStoredDislike(1, "track-1", true)
      expect(getDislikesSnapshot()["1"]).toEqual(["track-1"])

      setStoredDislike(1, "track-1", false)
      expect(getDislikesSnapshot()["1"]).toEqual([])
      setStoredDislike(1, "track-1", false)
      expect(getDislikesSnapshot()["1"]).toEqual([])
    })
  })
})

