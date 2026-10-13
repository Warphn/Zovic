import { Playlist } from "../entities/playlist.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";

export interface CreatePlaylistInput {
  creatorId: number;
  name: string;
  isPrivate?: boolean;
  color?: string | null;
}

export interface CreatePlaylistOutput {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  createdAt: string;
}

export interface CreatePlaylistUseCase {
  execute(input: CreatePlaylistInput): Promise<CreatePlaylistOutput>;
}

export class CreatePlaylist implements CreatePlaylistUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute(input: CreatePlaylistInput): Promise<CreatePlaylistOutput> {
    const id = await this.playlists.nextId();
    const playlist = Playlist.create({ id, ...input });

    await this.playlists.save(playlist);

    return {
      id: playlist.id,
      name: playlist.name,
      isPrivate: playlist.isPrivate,
      color: playlist.color,
      createdAt: playlist.createdAt.toISOString(),
    };
  }
}
