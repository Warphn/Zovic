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

  // Como o banco: os membros só entram na criação; depois, mudam por addMember e removeMember
  async save(playlist: Playlist): Promise<void> {
    this.saveCount += 1;
    const stored = this.rows.get(playlist.id);
    const data = playlist.toData();
    this.rows.set(playlist.id, Playlist.restore(stored ? { ...data, members: stored.members } : data));
  }

  async addMember(playlistId: number, userId: number): Promise<void> {
    const stored = this.rows.get(playlistId);
    if (!stored || stored.isMember(userId)) return;
    stored.addMember(userId);
  }

  async removeMember(playlistId: number, userId: number): Promise<void> {
    const stored = this.rows.get(playlistId);
    if (!stored || !stored.isMember(userId) || stored.isAdmin(userId)) return;
    stored.removeMember(userId);
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
