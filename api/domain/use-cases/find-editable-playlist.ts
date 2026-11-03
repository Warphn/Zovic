import type { Playlist } from "../entities/playlist.ts";
import { ForbiddenError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

/**
 * Carrega a playlist que o usuário pode editar: ele precisa vê-la (senão NotFoundError, como em
 * findVisiblePlaylist) e ser admin dela (senão ForbiddenError com `message`).
 */
export async function findEditablePlaylist(
  playlists: PlaylistRepository,
  playlistId: number,
  userId: number,
  message: string,
): Promise<Playlist> {
  const playlist = await findVisiblePlaylist(playlists, playlistId, userId);
  if (!playlist.isAdmin(userId)) {
    throw new ForbiddenError(message);
  }
  return playlist;
}
