import { describe, expect, it } from "bun:test";
import { InMemoryPlayHistory } from "../testing/in-memory-play-history.ts";
import { ListMyHistory } from "./list-my-history.ts";

const ANA = 1;
const BRUNO = 2;
const MUSIC_A = 10;
const MUSIC_B = 11;
const EXPLICIT_MUSIC = 12;
const NOW = new Date("2026-11-06T15:00:00Z");
const ADULT = { birthdate: "1995-03-12", now: NOW };
const MINOR = { birthdate: "2010-01-01", now: NOW };

function makeHistory(): InMemoryPlayHistory {
  const history = new InMemoryPlayHistory();
  history.catalog.set(MUSIC_A, { name: "A", isAvailable: true });
  history.catalog.set(MUSIC_B, { name: "B", isAvailable: true });
  history.catalog.set(EXPLICIT_MUSIC, { name: "Explícita", isAvailable: true, isExplicit: true });
  return history;
}

function play(history: InMemoryPlayHistory, userId: number, musicId: number, playedAt: string) {
  history.plays.push({ userId, musicId, playedAt: new Date(playedAt) });
}

function historyWithExplicitPlay(): InMemoryPlayHistory {
  const history = makeHistory();
  play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
  play(history, ANA, EXPLICIT_MUSIC, "2026-01-01T11:00:00Z");
  return history;
}

describe("ListMyHistory", () => {
  it("mostra cada música uma vez, com a última reprodução, da mais recente para a mais antiga", async () => {
    const history = makeHistory();
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    play(history, ANA, MUSIC_B, "2026-01-01T11:00:00Z");
    play(history, ANA, MUSIC_A, "2026-01-01T12:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA, ...ADULT });

    expect(output.map((entry) => [entry.musicId, entry.lastPlayedAt])).toEqual([
      [MUSIC_A, "2026-01-01T12:00:00.000Z"],
      [MUSIC_B, "2026-01-01T11:00:00.000Z"],
    ]);
  });

  it("mostra só as reproduções da própria conta", async () => {
    const history = makeHistory();
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    play(history, BRUNO, MUSIC_B, "2026-01-01T11:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA, ...ADULT });

    expect(output.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
  });

  it("mantém a música removida do catálogo, marcada como indisponível", async () => {
    const history = makeHistory();
    history.catalog.set(MUSIC_A, { name: "A", isAvailable: false });
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA, ...ADULT });

    expect(output.map((entry) => [entry.musicId, entry.isAvailable])).toEqual([[MUSIC_A, false]]);
  });

  it("devolve lista vazia para a conta que nunca ouviu nada", async () => {
    const output = await new ListMyHistory(makeHistory()).execute({ userId: ANA, ...ADULT });

    expect(output).toEqual([]);
  });

  describe("músicas explícitas (HU-09)", () => {
    it("esconde a explícita de menor de idade e de quem não tem data de nascimento", async () => {
      const useCase = new ListMyHistory(historyWithExplicitPlay());

      const asMinor = await useCase.execute({ userId: ANA, ...MINOR });
      const withoutBirthdate = await useCase.execute({ userId: ANA, birthdate: null, now: NOW });

      expect(asMinor.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
      expect(withoutBirthdate.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
    });

    it("mostra a explícita para maior de idade, para quem faz 18 anos hoje e para admin", async () => {
      const useCase = new ListMyHistory(historyWithExplicitPlay());
      const expected = [EXPLICIT_MUSIC, MUSIC_A];

      expect((await useCase.execute({ userId: ANA, ...ADULT })).map((entry) => entry.musicId)).toEqual(expected);
      expect(
        (await useCase.execute({ userId: ANA, birthdate: "2008-11-06", now: NOW })).map((entry) => entry.musicId),
      ).toEqual(expected);
      expect(
        (await useCase.execute({ userId: ANA, birthdate: null, now: NOW, isAdmin: true })).map((entry) => entry.musicId),
      ).toEqual(expected);
    });
  });
});
