import { describe, expect, it } from "bun:test"
import { calculateIsUnderage } from "./user-store.ts"
import { formatTime } from "./comments-store.ts"

describe("Frontend Stores & Helpers", () => {
  it("formata segundos em mm:ss", () => {
    expect(formatTime(0)).toBe("0:00")
    expect(formatTime(45)).toBe("0:45")
    expect(formatTime(68)).toBe("1:08")
    expect(formatTime(258)).toBe("4:18")
  })

  it("calcula maioridade e menoridade com referência em 2026", () => {
    // Nascido em 1995 -> 31 anos (Adulto)
    expect(calculateIsUnderage("1995-03-12")).toBe(false)
    // Nascido em 2010 -> 16 anos (Menor)
    expect(calculateIsUnderage("2010-06-28")).toBe(true)
    // Nascido em 2012 -> 14 anos (Menor)
    expect(calculateIsUnderage("2012-01-17")).toBe(true)
  })

  it("trata birthdate nulo, vazio ou inválido como menor de idade", () => {
    expect(calculateIsUnderage(null)).toBe(true)
    expect(calculateIsUnderage(undefined)).toBe(true)
    expect(calculateIsUnderage("")).toBe(true)
    expect(calculateIsUnderage("invalido")).toBe(true)
  })
})

