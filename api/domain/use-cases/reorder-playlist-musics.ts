import { BusinessRuleError } from "../errors/domain-error.ts";
import { canSeeExplicit } from "../shared/age.ts";
import type { PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findMusicEditablePlaylist } from "./find-music-editable-playlist.ts";
import { LIKED_SONGS_ONLY_THROUGH_LIKES } from "./liked-songs.ts";

export interface ReorderPlaylistMusicsInput {
  userId: number;
  playlistId: number;
  /** A sequência nova, com todas as músicas da playlist que a pessoa vê. */
  musicIds: number[];
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

/** As músicas da playlist na ordem nova. */
export type ReorderPlaylistMusicsOutput = PlaylistMusicItem[];

export interface ReorderPlaylistMusicsUseCase {
  execute(input: ReorderPlaylistMusicsInput): Promise<ReorderPlaylistMusicsOutput>;
}

/**
 * Dono e colaboradores da playlist (HU-19). A ordem é da playlist: todos que a veem enxergam a
 * mesma. Se a lista não tem exatamente as músicas da playlist que a pessoa vê (um menor de idade
 * não vê as explícitas, que ficam no fim, HU-09), alguém a mudou depois que ela foi carregada:
 * BusinessRuleError (409), para o front recarregar em vez de desfazer a mudança da outra pessoa.
 */
export class ReorderPlaylistMusics implements ReorderPlaylistMusicsUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute(input: ReorderPlaylistMusicsInput): Promise<ReorderPlaylistMusicsOutput> {
    const playlist = await findMusicEditablePlaylist(
      this.playlists,
      input.playlistId,
      input.userId,
      "Only playlist members can reorder musics",
    );
    if (playlist.isLikedSongs) throw new BusinessRuleError(LIKED_SONGS_ONLY_THROUGH_LIKES);

    if (new Set(input.musicIds).size !== input.musicIds.length) {
      throw new BusinessRuleError("The new order cannot repeat a music");
    }
    const includeExplicit = canSeeExplicit(input.birthdate, input.now, input.isAdmin);
    if (!(await this.musics.reorder(input.playlistId, input.musicIds, includeExplicit))) {
      throw new BusinessRuleError("The new order must have exactly the playlist's musics; reload it and try again");
    }

    return this.musics.list(input.playlistId, includeExplicit);
  }
}
