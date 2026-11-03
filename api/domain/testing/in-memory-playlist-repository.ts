import { Playlist } from "../entities/playlist.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";

/**
 * Fake do PlaylistRepository para os testes de use case. Guarda e devolve cópias, como o banco:
 * mexer na entidade carregada não muda nada até o `save`.
 */
export class InMemoryPlaylistRepository implements PlaylistRepository {
  private readonly rows = new Map<number, Playlist>();
  private lastId = 0;
  saveCount = 0;

  /** Todas as playlists guardadas, apagadas inclusive, na ordem em que foram criadas. */
  get items(): Playlist[] {
    return [...this.rows.values()].map(copy);
  }

  async nextId(): Promise<number> {
    this.lastId += 1;
    return this.lastId;
  }

  async save(playlist: Playlist): Promise<void> {
    this.saveCount += 1;
    this.rows.set(playlist.id, copy(playlist));
  }

  async findById(id: number): Promise<Playlist | null> {
    const playlist = this.rows.get(id);
    return playlist && playlist.deletedAt === null ? copy(playlist) : null;
  }

  async listByUser(userId: number): Promise<Playlist[]> {
    return [...this.rows.values()]
      .filter((playlist) => playlist.deletedAt === null && playlist.isMember(userId))
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .map(copy);
  }
}

function copy(playlist: Playlist): Playlist {
  return Playlist.restore(playlist.toData());
}
