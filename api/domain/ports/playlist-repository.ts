import type { Playlist } from "../entities/playlist.ts";

export interface PlaylistRepository {
  nextId(): Promise<number>;
  save(playlist: Playlist): Promise<void>;
  /** Só playlists ativas: devolve null se não existir ou estiver apagada. */
  findById(id: number): Promise<Playlist | null>;
  /** As playlists ativas de que o usuário é membro, da mais nova para a mais antiga. */
  listByUser(userId: number): Promise<Playlist[]>;
}
