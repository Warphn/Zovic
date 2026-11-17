import type { Playlist } from "../entities/playlist.ts";
import { versionedImageUrl } from "../shared/cover-image.ts";

/**
 * Playlist como sai dos use cases, vista por um usuário: `isAdmin` diz se ele é o dono (edita,
 * apaga e gerencia os colaboradores), e `canEditMusics` se ele mexe nas músicas (dono ou colaborador).
 */
export interface PlaylistOutput {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  createdAt: string;
  isAdmin: boolean;
  canEditMusics: boolean;
  /** A Músicas Curtidas da conta (HU-34): só muda pela curtida. */
  isLikedSongs: boolean;
  /** Endereço da capa (GET /api/playlists/:id/cover), com a versão no fim; null na playlist sem capa (HU-35). */
  coverUrl: string | null;
}

export function playlistCoverUrlOf(playlistId: number, coverFile: string | null): string | null {
  return coverFile === null ? null : versionedImageUrl(`/api/playlists/${playlistId}/cover`, coverFile);
}

export function toPlaylistOutput(playlist: Playlist, viewerId: number): PlaylistOutput {
  return {
    id: playlist.id,
    name: playlist.name,
    isPrivate: playlist.isPrivate,
    color: playlist.color,
    createdAt: playlist.createdAt.toISOString(),
    isAdmin: playlist.isAdmin(viewerId),
    canEditMusics: playlist.isMember(viewerId),
    isLikedSongs: playlist.isLikedSongs,
    coverUrl: playlistCoverUrlOf(playlist.id, playlist.coverFile),
  };
}
