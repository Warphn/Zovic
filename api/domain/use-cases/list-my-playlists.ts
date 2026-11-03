import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

export interface ListMyPlaylistsInput {
  userId: number;
}

export type ListMyPlaylistsOutput = PlaylistOutput[];

export interface ListMyPlaylistsUseCase {
  execute(input: ListMyPlaylistsInput): Promise<ListMyPlaylistsOutput>;
}

export class ListMyPlaylists implements ListMyPlaylistsUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute({ userId }: ListMyPlaylistsInput): Promise<ListMyPlaylistsOutput> {
    const playlists = await this.playlists.listByUser(userId);
    return playlists.map((playlist) => toPlaylistOutput(playlist, userId));
  }
}
