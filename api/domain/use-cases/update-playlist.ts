import { ForbiddenError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

/** Só os campos presentes mudam; `color: null` apaga a cor. */
export interface UpdatePlaylistInput {
  userId: number;
  playlistId: number;
  name?: string;
  isPrivate?: boolean;
  color?: string | null;
}

export type UpdatePlaylistOutput = PlaylistOutput;

export interface UpdatePlaylistUseCase {
  execute(input: UpdatePlaylistInput): Promise<UpdatePlaylistOutput>;
}

export class UpdatePlaylist implements UpdatePlaylistUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute(input: UpdatePlaylistInput): Promise<UpdatePlaylistOutput> {
    const playlist = await findVisiblePlaylist(this.playlists, input.playlistId, input.userId);
    if (!playlist.isAdmin(input.userId)) {
      throw new ForbiddenError("Only playlist admins can edit it");
    }

    if (input.name !== undefined) playlist.rename(input.name);
    if (input.color !== undefined) playlist.changeColor(input.color);
    if (input.isPrivate !== undefined) playlist.setPrivate(input.isPrivate);

    await this.playlists.save(playlist);

    return toPlaylistOutput(playlist, input.userId);
  }
}
