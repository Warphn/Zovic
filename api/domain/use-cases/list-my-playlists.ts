import { EnsureLikedSongs } from "./liked-songs.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import { type PlaylistOutput, toPlaylistOutput } from "./playlist-output.ts";

export interface ListMyPlaylistsInput {
  userId: number;
}

export type ListMyPlaylistsOutput = PlaylistOutput[];

export interface ListMyPlaylistsUseCase {
  execute(input: ListMyPlaylistsInput): Promise<ListMyPlaylistsOutput>;
}

/** As playlists da conta, com a Músicas Curtidas (HU-34) primeiro: ela é criada aqui se ainda não existe. */
export class ListMyPlaylists implements ListMyPlaylistsUseCase {
  private readonly ensureLikedSongs: EnsureLikedSongs;

  constructor(private readonly playlists: PlaylistRepository) {
    this.ensureLikedSongs = new EnsureLikedSongs(playlists);
  }

  async execute({ userId }: ListMyPlaylistsInput): Promise<ListMyPlaylistsOutput> {
    await this.ensureLikedSongs.execute({ userId });
    const playlists = await this.playlists.listByUser(userId);
    // A Músicas Curtidas primeiro; as outras na ordem do repositório (da mais nova para a mais antiga)
    const ordered = playlists.toSorted((first, second) => Number(second.isLikedSongs) - Number(first.isLikedSongs));
    return ordered.map((playlist) => toPlaylistOutput(playlist, userId));
  }
}
