import type { HistoryEntry, ListenedEntry, PlayHistory } from "../ports/play-history.ts";

interface Play {
  userId: number;
  musicId: number;
  playedAt: Date;
}

interface Listen {
  userId: number;
  musicId: number;
  listenedAt: Date;
}

interface CatalogMusic {
  name: string;
  isAvailable: boolean;
  isExplicit?: boolean;
}

/** Fake do port para os testes de domínio: agrupa por música e ordena como a consulta real. */
export class InMemoryPlayHistory implements PlayHistory {
  readonly plays: Play[] = [];
  readonly listens: Listen[] = [];
  readonly catalog = new Map<number, CatalogMusic>();

  listForUser(userId: number, includeExplicit: boolean): Promise<HistoryEntry[]> {
    const ownPlays = this.plays.filter(
      (play) => play.userId === userId && (includeExplicit || !this.catalog.get(play.musicId)!.isExplicit),
    );
    const entries = this.latestByMusic(ownPlays.map((play) => ({ musicId: play.musicId, at: play.playedAt }))).map(
      ({ musicId, at }) => ({ ...this.entryBase(musicId), lastPlayedAt: at.toISOString() }),
    );
    return Promise.resolve(entries);
  }

  markListened(userId: number, musicId: number): Promise<boolean> {
    if (!this.catalog.get(musicId)?.isAvailable) return Promise.resolve(false);
    this.listens.push({ userId, musicId, listenedAt: new Date() });
    return Promise.resolve(true);
  }

  listListenedForUser(userId: number): Promise<ListenedEntry[]> {
    const ownListens = this.listens.filter((listen) => listen.userId === userId);
    const entries = this.latestByMusic(ownListens.map((listen) => ({ musicId: listen.musicId, at: listen.listenedAt }))).map(
      ({ musicId, at }) => ({ ...this.entryBase(musicId), lastListenedAt: at.toISOString() }),
    );
    return Promise.resolve(entries);
  }

  /** A data mais recente de cada música, da mais recente para a mais antiga; empate pelo id. */
  private latestByMusic(events: { musicId: number; at: Date }[]): { musicId: number; at: Date }[] {
    const latestByMusic = new Map<number, Date>();
    for (const event of events) {
      const previous = latestByMusic.get(event.musicId);
      if (previous === undefined || event.at > previous) latestByMusic.set(event.musicId, event.at);
    }
    return [...latestByMusic]
      .map(([musicId, at]) => ({ musicId, at }))
      .toSorted((first, second) =>
        second.at.getTime() === first.at.getTime() ? first.musicId - second.musicId : second.at.getTime() - first.at.getTime(),
      );
  }

  private entryBase(musicId: number) {
    const music = this.catalog.get(musicId)!;
    return { musicId, name: music.name, duration: 200, artists: [], isAvailable: music.isAvailable };
  }
}
