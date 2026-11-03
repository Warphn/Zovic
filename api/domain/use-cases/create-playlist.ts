import { Playlist } from "../entities/playlist.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

export interface CreatePlaylistInput {
  creatorId: number;
  name: string;
  isPrivate?: boolean;
  color?: string | null;
}

export type CreatePlaylistOutput = PlaylistOutput;

export interface CreatePlaylistUseCase {
  execute(input: CreatePlaylistInput): Promise<CreatePlaylistOutput>;
}

export class CreatePlaylist implements CreatePlaylistUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute(input: CreatePlaylistInput): Promise<CreatePlaylistOutput> {
    const id = await this.playlists.nextId();
    const playlist = Playlist.create({ id, ...input });

    await this.playlists.save(playlist);

    return toPlaylistOutput(playlist, input.creatorId);
  }
}
