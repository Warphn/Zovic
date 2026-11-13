import { canSeeExplicit } from "../shared/age.ts";
import type { PlaylistMusicItem, PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

export interface ListPlaylistMusicsInput {
  userId: number;
  playlistId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export type ListPlaylistMusicsOutput = PlaylistMusicItem[];

export interface ListPlaylistMusicsUseCase {
  execute(input: ListPlaylistMusicsInput): Promise<ListPlaylistMusicsOutput>;
}

/**
 * Quem vê a playlist vê as músicas dela: a privada de outra pessoa dá NotFoundError. Menor de idade
 * não vê as explícitas, nem nas playlists de outras pessoas (HU-09).
 */
export class ListPlaylistMusics implements ListPlaylistMusicsUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute({ userId, playlistId, birthdate, now, isAdmin = false }: ListPlaylistMusicsInput): Promise<ListPlaylistMusicsOutput> {
    await findVisiblePlaylist(this.playlists, playlistId, userId);
    return this.musics.list(playlistId, canSeeExplicit(birthdate, now, isAdmin));
  }
}
