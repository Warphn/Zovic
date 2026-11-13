import { describe, expect, it } from "bun:test";
import { calendarDateIn, canSeeExplicit, isAdult, isMinor } from "./age.ts";

describe("isAdult", () => {
  it("é maior de idade a partir do dia em que completa 18 anos", () => {
    expect(isAdult("2008-10-26", "2026-10-25")).toBe(false);
    expect(isAdult("2008-10-26", "2026-10-26")).toBe(true);
    expect(isAdult("1990-01-01", "2026-10-26")).toBe(true);
    expect(isAdult("2012-01-17", "2026-10-26")).toBe(false);
  });

  // Código Civil, art. 132 §3º: sem o dia correspondente, o prazo vence no dia seguinte
  it("quem nasceu em 29 de fevereiro completa 18 anos em 1º de março, fora de ano bissexto", () => {
    expect(isAdult("2008-02-29", "2026-02-28")).toBe(false);
    expect(isAdult("2008-02-29", "2026-03-01")).toBe(true);
  });

  it("sem data de nascimento conhecida, não é tratado como maior de idade", () => {
    expect(isAdult(null, "2026-10-26")).toBe(false);
    expect(isAdult("", "2026-10-26")).toBe(false);
  });
});

describe("calendarDateIn", () => {
  it("usa o dia do fuso pedido, não o de UTC", () => {
    // 01:30 UTC de 27/10 ainda é 26/10 em São Paulo (UTC-3)
    const instant = new Date("2026-10-27T01:30:00Z");
    expect(calendarDateIn(instant, "America/Sao_Paulo")).toBe("2026-10-26");
    expect(calendarDateIn(instant, "UTC")).toBe("2026-10-27");
  });
});

describe("canSeeExplicit", () => {
  const NOW = new Date("2026-11-06T15:00:00Z");

  it("maior de idade vê, menor não", () => {
    expect(canSeeExplicit("1995-03-12", NOW)).toBe(true);
    expect(canSeeExplicit("2010-01-01", NOW)).toBe(false);
  });

  it("sem data de nascimento conta como menor", () => {
    expect(canSeeExplicit(null, NOW)).toBe(false);
  });

  it("quem completa 18 anos hoje passa a ver, e quem completa amanhã ainda não", () => {
    expect(canSeeExplicit("2008-11-06", NOW)).toBe(true);
    expect(canSeeExplicit("2008-11-07", NOW)).toBe(false);
  });

  it("o dia é o de São Paulo: 01:30 UTC ainda é o dia anterior", () => {
    const earlyUtc = new Date("2026-11-07T01:30:00Z");
    expect(canSeeExplicit("2008-11-07", earlyUtc)).toBe(false);
    expect(canSeeExplicit("2008-11-06", earlyUtc)).toBe(true);
  });

  it("admin vê mesmo sem data de nascimento", () => {
    expect(canSeeExplicit(null, NOW, true)).toBe(true);
  });
});

describe("isMinor", () => {
  const NOW = new Date("2026-11-06T15:00:00Z");

  it("é o oposto de maior de idade, e sem data de nascimento conta como menor", () => {
    expect(isMinor("2010-01-01", NOW)).toBe(true);
    expect(isMinor("2008-11-06", NOW)).toBe(false);
    expect(isMinor("1995-03-12", NOW)).toBe(false);
    expect(isMinor(null, NOW)).toBe(true);
  });
});
