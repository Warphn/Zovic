import { describe, expect, it } from "bun:test";
import { InMemoryPlayHistory } from "../testing/in-memory-play-history.ts";
import { ListMyListenedMusics } from "./list-my-listened-musics.ts";

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

function listen(history: InMemoryPlayHistory, userId: number, musicId: number, listenedAt: string) {
  history.listens.push({ userId, musicId, listenedAt: new Date(listenedAt) });
}

describe("ListMyListenedMusics", () => {
  it("mostra cada música uma vez, da marca mais recente para a mais antiga", async () => {
    const history = makeHistory();
    listen(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    listen(history, ANA, MUSIC_B, "2026-01-01T11:00:00Z");
    listen(history, ANA, MUSIC_A, "2026-01-01T12:00:00Z");

    const output = await new ListMyListenedMusics(history).execute({ userId: ANA });

    expect(output.map((entry) => [entry.musicId, entry.lastListenedAt])).toEqual([
      [MUSIC_A, "2026-01-01T12:00:00.000Z"],
      [MUSIC_B, "2026-01-01T11:00:00.000Z"],
    ]);
  });

  it("mostra só as marcas da própria conta", async () => {
    const history = makeHistory();
    listen(history, ANA, MUSIC_A, "2026-01-01T10:00:00Z");
    listen(history, BRUNO, MUSIC_B, "2026-01-01T11:00:00Z");

    const output = await new ListMyListenedMusics(history).execute({ userId: ANA });

    expect(output.map((entry) => entry.musicId)).toEqual([MUSIC_A]);
  });
});
