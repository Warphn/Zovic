import type {
  RecommendationCandidate,
  RecommendationSource,
  RecommendedMusic,
  TasteSignals,
} from "../ports/recommendation-source.ts";

export interface CatalogMusic extends RecommendationCandidate {
  isExplicit?: boolean;
  isRemoved?: boolean;
}

/** Fake do port para os testes de domínio: aplica as mesmas exclusões da consulta real. */
export class InMemoryRecommendationSource implements RecommendationSource {
  readonly catalog: CatalogMusic[] = [];
  readonly listenedByUser = new Map<number, number[]>();
  readonly likedByUser = new Map<number, number[]>();

  listTasteSignals(userId: number): Promise<TasteSignals> {
    const toSignals = (musicIds: number[] = []) =>
      musicIds.map((musicId) => {
        const music = this.catalog.find((entry) => entry.id === musicId)!;
        return { genreIds: music.genreIds, artistIds: music.artists.map((artist) => artist.id) };
      });
    return Promise.resolve({
      listened: toSignals(this.listenedByUser.get(userId)),
      liked: toSignals(this.likedByUser.get(userId)),
    });
  }

  listCandidates(userId: number, includeExplicit: boolean): Promise<RecommendationCandidate[]> {
    const listenedIds = this.listenedByUser.get(userId) ?? [];
    return Promise.resolve(
      this.activeMusics(includeExplicit).filter((music) => !listenedIds.includes(music.id)),
    );
  }

  listMostPlayed(limit: number, includeExplicit: boolean): Promise<RecommendedMusic[]> {
    const mostPlayed = this.activeMusics(includeExplicit)
      .toSorted((first, second) => second.streams - first.streams || first.id - second.id)
      .slice(0, limit)
      .map(({ id, name, duration, artists }) => ({ id, name, duration, artists }));
    return Promise.resolve(mostPlayed);
  }

  private activeMusics(includeExplicit: boolean): CatalogMusic[] {
    return this.catalog.filter((music) => !music.isRemoved && (includeExplicit || !music.isExplicit));
  }
}
