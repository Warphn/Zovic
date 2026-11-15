import { BusinessRuleError } from "../errors/domain-error.ts";
import type { PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findMusicEditablePlaylist } from "./find-music-editable-playlist.ts";

export interface ReorderPlaylistMusicsInput {
  userId: number;
  playlistId: number;
  /** A sequência nova, com todas as músicas da playlist. */
  musicIds: number[];
}

/** As músicas da playlist na ordem nova. */
export type ReorderPlaylistMusicsOutput = PlaylistMusicItem[];

export interface ReorderPlaylistMusicsUseCase {
  execute(input: ReorderPlaylistMusicsInput): Promise<ReorderPlaylistMusicsOutput>;
}

/**
 * Dono e colaboradores da playlist (HU-19). A ordem é da playlist: todos que a veem enxergam a mesma. Se a lista
 * não tem exatamente as músicas da playlist, alguém a mudou depois que ela foi carregada:
 * BusinessRuleError (409), para o front recarregar em vez de desfazer a mudança da outra pessoa.
 */
export class ReorderPlaylistMusics implements ReorderPlaylistMusicsUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute(input: ReorderPlaylistMusicsInput): Promise<ReorderPlaylistMusicsOutput> {
    await findMusicEditablePlaylist(this.playlists, input.playlistId, input.userId, "Only playlist members can reorder musics");

    if (new Set(input.musicIds).size !== input.musicIds.length) {
      throw new BusinessRuleError("The new order cannot repeat a music");
    }
    if (!(await this.musics.reorder(input.playlistId, input.musicIds))) {
      throw new BusinessRuleError("The new order must have exactly the playlist's musics; reload it and try again");
    }

    return this.musics.list(input.playlistId);
  }
}
