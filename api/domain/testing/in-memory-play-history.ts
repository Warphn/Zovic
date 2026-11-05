import type { HistoryEntry, PlayHistory } from "../ports/play-history.ts";

interface Play {
  userId: number;
  musicId: number;
  playedAt: Date;
}

interface CatalogMusic {
  name: string;
  isAvailable: boolean;
}

/** Fake do port para os testes de domínio: agrupa por música e ordena como a consulta real. */
export class InMemoryPlayHistory implements PlayHistory {
  readonly plays: Play[] = [];
  readonly catalog = new Map<number, CatalogMusic>();

  listForUser(userId: number): Promise<HistoryEntry[]> {
    const lastPlayByMusic = new Map<number, Date>();
    for (const play of this.plays) {
      if (play.userId !== userId) continue;
      const previous = lastPlayByMusic.get(play.musicId);
      if (previous === undefined || play.playedAt > previous) lastPlayByMusic.set(play.musicId, play.playedAt);
    }

    const entries = [...lastPlayByMusic]
      .toSorted(([firstId, firstDate], [secondId, secondDate]) =>
        secondDate.getTime() === firstDate.getTime() ? firstId - secondId : secondDate.getTime() - firstDate.getTime(),
      )
      .map(([musicId, lastPlayedAt]) => {
        const music = this.catalog.get(musicId)!;
        return {
          musicId,
          name: music.name,
          duration: 200,
          artists: [],
          lastPlayedAt: lastPlayedAt.toISOString(),
          isAvailable: music.isAvailable,
        };
      });
    return Promise.resolve(entries);
  }
}
