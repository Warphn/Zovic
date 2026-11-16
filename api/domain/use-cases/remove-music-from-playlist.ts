import { NotFoundError } from "../errors/domain-error.ts";
import type { PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findMusicEditablePlaylist } from "./find-music-editable-playlist.ts";

export interface RemoveMusicFromPlaylistInput {
  userId: number;
  playlistId: number;
  musicId: number;
}

export interface RemoveMusicFromPlaylistUseCase {
  execute(input: RemoveMusicFromPlaylistInput): Promise<void>;
}

/** Dono e colaboradores da playlist (HU-19). Tirar uma música que não está nela dá NotFoundError. */
export class RemoveMusicFromPlaylist implements RemoveMusicFromPlaylistUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute(input: RemoveMusicFromPlaylistInput): Promise<void> {
    await findMusicEditablePlaylist(this.playlists, input.playlistId, input.userId, "Only playlist members can remove musics");

    if (!(await this.musics.remove(input.playlistId, input.musicId))) {
      throw new NotFoundError("Music is not in this playlist");
    }
  }
}
