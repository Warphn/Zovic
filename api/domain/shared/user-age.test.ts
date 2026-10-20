import { describe, expect, it } from "bun:test";
import { calculateAge, isUnderage } from "./user-age.ts";

describe("user-age", () => {
  const ref = new Date("2026-10-20T12:00:00Z");

  it("calcula idade corretamente antes e depois do aniversário", () => {
    // Aniversário já passou em 2026
    expect(calculateAge(new Date("2000-05-10"), ref)).toBe(26);
    // Aniversário ainda não passou em 2026
    expect(calculateAge(new Date("2000-11-15"), ref)).toBe(25);
    // No dia exato do aniversário de 18 anos
    expect(calculateAge(new Date("2008-10-20"), ref)).toBe(18);
    // Um dia antes de fazer 18 anos
    expect(calculateAge(new Date("2008-10-21"), ref)).toBe(17);
  });

  it("identifica menores e maiores de 18 anos", () => {
    expect(isUnderage(new Date("2000-01-01"), ref)).toBe(false);
    expect(isUnderage(new Date("2008-10-20"), ref)).toBe(false); // 18 anos completos
    expect(isUnderage(new Date("2008-10-21"), ref)).toBe(true);  // 17 anos e 364 dias
    expect(isUnderage(new Date("2010-06-28"), ref)).toBe(true);  // 16 anos (ex: Heitor)
    expect(isUnderage(new Date("2012-01-17"), ref)).toBe(true);  // 14 anos (ex: Isabela)
  });

  it("trata birthdate vazio, nulo ou indefinido como menor de idade", () => {
    expect(isUnderage(null, ref)).toBe(true);
    expect(isUnderage(undefined, ref)).toBe(true);
    expect(isUnderage("", ref)).toBe(true);
    expect(isUnderage("data-invalida", ref)).toBe(true);
  });
});

