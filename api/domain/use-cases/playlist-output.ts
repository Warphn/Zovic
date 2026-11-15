import type { Playlist } from "../entities/playlist.ts";

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
  };
}
