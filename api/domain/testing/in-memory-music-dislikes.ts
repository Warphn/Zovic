import type { MusicDislikes } from "../ports/music-dislikes.ts";

interface Dislike {
  userId: number;
  musicId: number;
}

/** Fake do port para os testes de domínio: guarda os dislikes na ordem em que chegaram. */
export class InMemoryMusicDislikes implements MusicDislikes {
  readonly dislikes: Dislike[] = [];
  /** As músicas ativas do catálogo; as de `explicitIds` só aceitam dislike com `includeExplicit`. */
  readonly catalogIds = new Set<number>();
  readonly explicitIds = new Set<number>();

  listMusicIds(userId: number): Promise<number[]> {
    const musicIds = this.dislikes.filter((dislike) => dislike.userId === userId).map((dislike) => dislike.musicId);
    return Promise.resolve(musicIds.toReversed());
  }

  add(userId: number, musicId: number, includeExplicit: boolean): Promise<boolean> {
    const isVisible = this.catalogIds.has(musicId) && (includeExplicit || !this.explicitIds.has(musicId));
    if (!isVisible) return Promise.resolve(false);
    if (!this.has(userId, musicId)) this.dislikes.push({ userId, musicId });
    return Promise.resolve(true);
  }

  remove(userId: number, musicId: number): Promise<void> {
    const index = this.dislikes.findIndex((dislike) => dislike.userId === userId && dislike.musicId === musicId);
    if (index !== -1) this.dislikes.splice(index, 1);
    return Promise.resolve();
  }

  has(userId: number, musicId: number): boolean {
    return this.dislikes.some((dislike) => dislike.userId === userId && dislike.musicId === musicId);
  }
}
