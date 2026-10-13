import type { Playlist } from "../entities/playlist.ts";

export interface PlaylistRepository {
  nextId(): Promise<number>;
  save(playlist: Playlist): Promise<void>;
}
