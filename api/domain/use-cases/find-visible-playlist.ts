import type { Playlist } from "../entities/playlist.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";

/**
 * Carrega a playlist que o usuário pode ver: qualquer pública, ou uma privada de que ele é membro.
 * A privada de outra pessoa dá o mesmo NotFoundError da inexistente, para não revelar que o id existe.
 */
export async function findVisiblePlaylist(
  playlists: PlaylistRepository,
  playlistId: number,
  userId: number,
): Promise<Playlist> {
  const playlist = await playlists.findById(playlistId);
  if (!playlist || (playlist.isPrivate && !playlist.isMember(userId))) {
    throw new NotFoundError("Playlist not found");
  }
  return playlist;
}
