import { ForbiddenError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

export interface DeletePlaylistInput {
  userId: number;
  playlistId: number;
  now?: Date;
}

export interface DeletePlaylistUseCase {
  execute(input: DeletePlaylistInput): Promise<void>;
}

/** Soft delete. Apagar de novo dá NotFoundError: a playlist apagada já não é encontrada. */
export class DeletePlaylist implements DeletePlaylistUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute(input: DeletePlaylistInput): Promise<void> {
    const playlist = await findVisiblePlaylist(this.playlists, input.playlistId, input.userId);
    if (!playlist.isAdmin(input.userId)) {
      throw new ForbiddenError("Only playlist admins can delete it");
    }

    playlist.delete(input.now);
    await this.playlists.save(playlist);
  }
}
