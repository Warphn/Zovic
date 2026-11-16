import { describe, expect, it } from "bun:test";
import { InMemoryPlayHistory } from "../testing/in-memory-play-history.ts";
import { ListMyListenedMusics } from "./list-my-listened-musics.ts";

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

function listen(history: InMemoryPlayHistory, userId: number, musicId: number, listenedAt: string) {
  history.listens.push({ userId, musicId, listenedAt: new Date(listenedAt) });
}

function historyWithExplicitListen(): InMemoryPlayHistory {
  const history = makeHistory();
  listen(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
  listen(history, ANA, EXPLICIT_MUSIC, "2026-01-01T11:00:00Z");
  return history;
}

describe("ListMyListenedMusics", () => {
  it("mostra cada música uma vez, da marca mais recente para a mais antiga", async () => {
    const history = makeHistory();
    listen(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    listen(history, ANA, MUSIC_B, "2026-01-01T11:00:00Z");
    listen(history, ANA, MUSIC_A, "2026-01-01T12:00:00Z");

    const output = await new ListMyListenedMusics(history).execute({ userId: ANA, ...ADULT });

    expect(output.map((entry) => [entry.musicId, entry.lastListenedAt])).toEqual([
      [MUSIC_A, "2026-01-01T12:00:00.000Z"],
      [MUSIC_B, "2026-01-01T11:00:00.000Z"],
    ]);
  });

  it("mostra só as marcas da própria conta", async () => {
    const history = makeHistory();
    listen(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    listen(history, BRUNO, MUSIC_B, "2026-01-01T11:00:00Z");

    const output = await new ListMyListenedMusics(history).execute({ userId: ANA, ...ADULT });

    expect(output.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
  });

  describe("músicas explícitas (HU-09)", () => {
    it("esconde a explícita de menor de idade e de quem não tem data de nascimento", async () => {
      const useCase = new ListMyListenedMusics(historyWithExplicitListen());

      const asMinor = await useCase.execute({ userId: ANA, ...MINOR });
      const withoutBirthdate = await useCase.execute({ userId: ANA, birthdate: null, now: NOW });

      expect(asMinor.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
      expect(withoutBirthdate.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
    });

    it("mostra a explícita para maior de idade e para admin", async () => {
      const useCase = new ListMyListenedMusics(historyWithExplicitListen());
      const expected = [EXPLICIT_MUSIC, MUSIC_A];

      expect((await useCase.execute({ userId: ANA, ...ADULT })).map((entry) => entry.musicId)).toEqual(expected);
      expect(
        (await useCase.execute({ userId: ANA, birthdate: null, now: NOW, isAdmin: true })).map((entry) => entry.musicId),
      ).toEqual(expected);
    });
  });
});
