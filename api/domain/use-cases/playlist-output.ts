import type { Playlist } from "../entities/playlist.ts";

/** Playlist como sai dos use cases, vista por um usuário: `isAdmin` diz se ele pode editá-la e apagá-la. */
export interface PlaylistOutput {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export function toPlaylistOutput(playlist: Playlist, viewerId: number): PlaylistOutput {
  return {
    id: playlist.id,
    name: playlist.name,
    isPrivate: playlist.isPrivate,
    color: playlist.color,
    createdAt: playlist.createdAt.toISOString(),
    isAdmin: playlist.isAdmin(viewerId),
  };
}
