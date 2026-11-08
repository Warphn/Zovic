import { describe, expect, it } from "bun:test";
import { InMemoryPlayHistory } from "../testing/in-memory-play-history.ts";
import { ListMyHistory } from "./list-my-history.ts";

const ANA = 1;
const BRUNO = 2;
const MUSIC_A = 10;
const MUSIC_B = 11;

function makeHistory(): InMemoryPlayHistory {
  const history = new InMemoryPlayHistory();
  history.catalog.set(MUSIC_A, { name: "A", isAvailable: true });
  history.catalog.set(MUSIC_B, { name: "B", isAvailable: true });
  return history;
}

function play(history: InMemoryPlayHistory, userId: number, musicId: number, playedAt: string) {
  history.plays.push({ userId, musicId, playedAt: new Date(playedAt) });
}

describe("ListMyHistory", () => {
  it("mostra cada música uma vez, com a última reprodução, da mais recente para a mais antiga", async () => {
    const history = makeHistory();
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    play(history, ANA, MUSIC_B, "2026-01-01T11:00:00Z");
    play(history, ANA, MUSIC_A, "2026-01-01T12:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA });

    expect(output.map((entry) => [entry.musicId, entry.lastPlayedAt])).toEqual([
      [MUSIC_A, "2026-01-01T12:00:00.000Z"],
      [MUSIC_B, "2026-01-01T11:00:00.000Z"],
    ]);
  });

  it("mostra só as reproduções da própria conta", async () => {
    const history = makeHistory();
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    play(history, BRUNO, MUSIC_B, "2026-01-01T11:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA });

    expect(output.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
  });

  it("mantém a música removida do catálogo, marcada como indisponível", async () => {
    const history = makeHistory();
    history.catalog.set(MUSIC_A, { name: "A", isAvailable: false });
    play(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");

    const output = await new ListMyHistory(history).execute({ userId: ANA });

    expect(output.map((entry) => [entry.musicId, entry.isAvailable])).toEqual([[MUSIC_A, false]]);
  });

  it("devolve lista vazia para a conta que nunca ouviu nada", async () => {
    const output = await new ListMyHistory(makeHistory()).execute({ userId: ANA });

    expect(output).toEqual([]);
  });
});
