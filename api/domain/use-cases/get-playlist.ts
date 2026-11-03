import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

export interface GetPlaylistInput {
  userId: number;
  playlistId: number;
}

export type GetPlaylistOutput = PlaylistOutput;

export interface GetPlaylistUseCase {
  execute(input: GetPlaylistInput): Promise<GetPlaylistOutput>;
}

export class GetPlaylist implements GetPlaylistUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute({ userId, playlistId }: GetPlaylistInput): Promise<GetPlaylistOutput> {
    const playlist = await findVisiblePlaylist(this.playlists, playlistId, userId);
    return toPlaylistOutput(playlist, userId);
  }
}
