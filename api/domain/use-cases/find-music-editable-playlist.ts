import type { Playlist } from "../entities/playlist.ts";
import { ForbiddenError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

/**
 * Carrega a playlist cujas músicas o usuário pode mudar: ele precisa vê-la (senão NotFoundError,
 * como em findVisiblePlaylist) e ser membro dela, dono ou colaborador (HU-19; senão ForbiddenError).
 */
export async function findMusicEditablePlaylist(
  playlists: PlaylistRepository,
  playlistId: number,
  userId: number,
  message: string,
): Promise<Playlist> {
  const playlist = await findVisiblePlaylist(playlists, playlistId, userId);
  if (!playlist.isMember(userId)) {
    throw new ForbiddenError(message);
  }
  return playlist;
}
