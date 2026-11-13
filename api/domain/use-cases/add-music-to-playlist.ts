import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import { canSeeExplicit } from "../shared/age.ts";
import type { PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findEditablePlaylist } from "./find-editable-playlist.ts";

export interface AddMusicToPlaylistInput {
  userId: number;
  playlistId: number;
  musicId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  /** Também vira a data em que a música entrou na playlist. */
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

/** As músicas da playlist já com a nova, no fim. */
export type AddMusicToPlaylistOutput = PlaylistMusicItem[];

export interface AddMusicToPlaylistUseCase {
  execute(input: AddMusicToPlaylistInput): Promise<AddMusicToPlaylistOutput>;
}

/**
 * Só admins da playlist. A música entra no fim; a mesma música não entra duas vezes. Para menor de
 * idade, a explícita é NotFoundError, como se não existisse (HU-09).
 */
export class AddMusicToPlaylist implements AddMusicToPlaylistUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute(input: AddMusicToPlaylistInput): Promise<AddMusicToPlaylistOutput> {
    await findEditablePlaylist(this.playlists, input.playlistId, input.userId, "Only playlist admins can add musics");

    const includeExplicit = canSeeExplicit(input.birthdate, input.now, input.isAdmin);
    const result = await this.musics.add(input.playlistId, input.musicId, includeExplicit, input.now);
    if (result === "music_not_found") throw new NotFoundError("Music not found");
    if (result === "already_in_playlist") throw new BusinessRuleError("Music is already in this playlist");

    return this.musics.list(input.playlistId, includeExplicit);
  }
}
