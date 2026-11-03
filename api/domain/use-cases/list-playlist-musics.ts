import type { PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

export interface ListPlaylistMusicsInput {
  userId: number;
  playlistId: number;
}

export type ListPlaylistMusicsOutput = PlaylistMusicItem[];

export interface ListPlaylistMusicsUseCase {
  execute(input: ListPlaylistMusicsInput): Promise<ListPlaylistMusicsOutput>;
}

/** Quem vê a playlist vê as músicas dela: a privada de outra pessoa dá NotFoundError. */
export class ListPlaylistMusics implements ListPlaylistMusicsUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute({ userId, playlistId }: ListPlaylistMusicsInput): Promise<ListPlaylistMusicsOutput> {
    await findVisiblePlaylist(this.playlists, playlistId, userId);
    return this.musics.list(playlistId);
  }
}
