import { NotFoundError } from "../errors/domain-error.ts";
import type { FileStorage } from "../ports/file-storage.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { validateCover } from "../shared/cover-image.ts";
import { findEditablePlaylist } from "./find-editable-playlist.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

// Imagem de capa da playlist (HU-35): opcional, só o dono troca ou remove, e quem vê a playlist vê a capa.

const ONLY_OWNER = "Only the playlist owner changes its cover";

export interface ChangePlaylistCoverInput {
  userId: number;
  playlistId: number;
  /** Os bytes da imagem enviada; null quando nenhuma veio. */
  cover: Uint8Array | null;
}

export interface ChangePlaylistCoverUseCase {
  execute(input: ChangePlaylistCoverInput): Promise<PlaylistOutput>;
}

/** Como a troca de capa do álbum: a capa antiga só sai do disco depois que a playlist foi salva com a nova. */
export class ChangePlaylistCover implements ChangePlaylistCoverUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly covers: FileStorage,
  ) {}

  async execute({ userId, playlistId, cover }: ChangePlaylistCoverInput): Promise<PlaylistOutput> {
    const playlist = await findEditablePlaylist(this.playlists, playlistId, userId, ONLY_OWNER);
    const extension = validateCover(cover, "Playlist cover image is required");
    const previousCover = playlist.coverFile;

    const coverFile = await this.covers.save(cover!, extension);
    try {
      playlist.changeCover(coverFile);
      await this.playlists.save(playlist);
    } catch (error) {
      await this.covers.remove(coverFile);
      throw error;
    }
    if (previousCover !== null) await this.covers.remove(previousCover);
    return toPlaylistOutput(playlist, userId);
  }
}

export interface RemovePlaylistCoverInput {
  userId: number;
  playlistId: number;
}

export interface RemovePlaylistCoverUseCase {
  execute(input: RemovePlaylistCoverInput): Promise<PlaylistOutput>;
}

/** Sem capa, a playlist volta às iniciais sobre a cor dela. Tirar a capa de quem não tem não é erro. */
export class RemovePlaylistCover implements RemovePlaylistCoverUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly covers: FileStorage,
  ) {}

  async execute({ userId, playlistId }: RemovePlaylistCoverInput): Promise<PlaylistOutput> {
    const playlist = await findEditablePlaylist(this.playlists, playlistId, userId, ONLY_OWNER);
    const previousCover = playlist.coverFile;

    playlist.removeCover();
    await this.playlists.save(playlist);
    if (previousCover !== null) await this.covers.remove(previousCover);
    return toPlaylistOutput(playlist, userId);
  }
}

export interface GetPlaylistCoverInput {
  userId: number;
  playlistId: number;
}

export interface GetPlaylistCoverUseCase {
  /** O nome do arquivo da capa, para a rota que o entrega. */
  execute(input: GetPlaylistCoverInput): Promise<{ coverFile: string }>;
}

/** A capa de uma playlist privada de outra pessoa dá o mesmo 404 da playlist, para não revelar que ela existe. */
export class GetPlaylistCover implements GetPlaylistCoverUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute({ userId, playlistId }: GetPlaylistCoverInput): Promise<{ coverFile: string }> {
    const playlist = await findVisiblePlaylist(this.playlists, playlistId, userId);
    if (playlist.coverFile === null) throw new NotFoundError("Cover not found");
    return { coverFile: playlist.coverFile };
  }
}
