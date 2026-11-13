import type { AddMusicResult, PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";

interface Entry {
  playlistId: number;
  musicId: number;
  position: number;
  addedAt: Date;
}

/** Fake do port para os testes de domínio. `catalog` são as músicas que existem e estão ativas. */
export class InMemoryPlaylistMusics implements PlaylistMusics {
  readonly entries: Entry[] = [];
  readonly catalog = new Map<number, string>();
  /** Ids do catálogo marcados como explícitos. */
  readonly explicitIds = new Set<number>();

  private isVisible(musicId: number, includeExplicit: boolean): boolean {
    return this.catalog.has(musicId) && (includeExplicit || !this.explicitIds.has(musicId));
  }

  list(playlistId: number, includeExplicit: boolean): Promise<PlaylistMusicItem[]> {
    const items = this.entries
      .filter((e) => e.playlistId === playlistId && this.isVisible(e.musicId, includeExplicit))
      .toSorted((a, b) => a.position - b.position)
      .map((e) => ({
        id: e.musicId,
        name: this.catalog.get(e.musicId)!,
        duration: 200,
        artists: [],
        album: null,
        addedAt: e.addedAt.toISOString(),
      }));
    return Promise.resolve(items);
  }

  add(playlistId: number, musicId: number, includeExplicit: boolean, now: Date = new Date()): Promise<AddMusicResult> {
    if (!this.isVisible(musicId, includeExplicit)) return Promise.resolve("music_not_found");
    const inPlaylist = this.entries.filter((e) => e.playlistId === playlistId);
    if (inPlaylist.some((e) => e.musicId === musicId)) return Promise.resolve("already_in_playlist");

    const position = Math.max(-1, ...inPlaylist.map((e) => e.position)) + 1;
    this.entries.push({ playlistId, musicId, position, addedAt: now });
    return Promise.resolve("added");
  }

  remove(playlistId: number, musicId: number, includeExplicit: boolean): Promise<boolean> {
    const index = this.entries.findIndex((e) => e.playlistId === playlistId && e.musicId === musicId);
    if (index === -1 || (!includeExplicit && this.explicitIds.has(musicId))) return Promise.resolve(false);
    this.entries.splice(index, 1);
    return Promise.resolve(true);
  }

  reorder(playlistId: number, musicIds: readonly number[], includeExplicit: boolean): Promise<boolean> {
    const active = this.entries.filter((e) => e.playlistId === playlistId && this.isVisible(e.musicId, includeExplicit));
    const sameSet = active.length === musicIds.length && active.every((e) => musicIds.includes(e.musicId));
    if (!sameSet) return Promise.resolve(false);

    for (const entry of active) entry.position = musicIds.indexOf(entry.musicId);
    return Promise.resolve(true);
  }
}
