import { describe, expect, it } from "bun:test";
import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import { InMemoryPlayHistory } from "../testing/in-memory-play-history.ts";
import { MarkMusicListened } from "./mark-music-listened.ts";

const ANA = 1;
const MUSIC_A = 10;
const REMOVED_MUSIC = 11;
const UNKNOWN_MUSIC = 99;

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

function makeHistory(): InMemoryPlayHistory {
  const history = new InMemoryPlayHistory();
  history.catalog.set(MUSIC_A, { name: "A", isAvailable: true });
  history.catalog.set(REMOVED_MUSIC, { name: "Removida", isAvailable: false });
  return history;
}

describe("MarkMusicListened", () => {
  it("recusa 20 s e 30 s com BusinessRuleError e não marca nada", async () => {
    const history = makeHistory();
    const markMusicListened = new MarkMusicListened(history);

    for (const playedSeconds of [20, 30]) {
      expect(await failure(markMusicListened.execute({ userId: ANA, musicId: MUSIC_A, playedSeconds }))).toBeInstanceOf(
        BusinessRuleError,
      );
    }

    expect(history.listens).toHaveLength(0);
  });

  it("marca a música com 31 s", async () => {
    const history = makeHistory();

    await new MarkMusicListened(history).execute({ userId: ANA, musicId: MUSIC_A, playedSeconds: 31 });

    expect(history.listens).toHaveLength(1);
    expect(history.listens[0]).toMatchObject({ userId: ANA, musicId: MUSIC_A });
  });

  it("dá NotFoundError para música inexistente ou removida", async () => {
    const markMusicListened = new MarkMusicListened(makeHistory());

    for (const musicId of [UNKNOWN_MUSIC, REMOVED_MUSIC]) {
      expect(await failure(markMusicListened.execute({ userId: ANA, musicId, playedSeconds: 31 }))).toBeInstanceOf(
        NotFoundError,
      );
    }
  });
});
