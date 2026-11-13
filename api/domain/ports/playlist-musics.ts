// As músicas de uma playlist, na ordem da playlist. A leitura devolve DTOs prontos (cruza músicas,
// artistas e álbuns), como as outras consultas; as escritas só mexem em music_playlist.
// Quem pode ver ou editar a playlist é decidido antes, nos casos de uso. Com `includeExplicit`
// falso (menores de idade, HU-09), as músicas explícitas é como se não estivessem na playlist.

export interface PlaylistMusicItem {
  id: number;
  name: string;
  /** Segundos. */
  duration: number;
  /** Artistas ativos da música, em ordem alfabética. */
  artists: { id: number; name: string }[];
  /** O álbum ativo de menor id que contém a música, ou null se ela não está em nenhum. */
  album: { id: number; name: string } | null;
  /** Quando a música entrou na playlist (ISO). */
  addedAt: string;
}

export type AddMusicResult = "added" | "music_not_found" | "already_in_playlist";

export interface PlaylistMusics {
  /** As músicas ativas da playlist, por posição. Músicas com soft delete ficam de fora. */
  list(playlistId: number, includeExplicit: boolean): Promise<PlaylistMusicItem[]>;

  /** Põe a música no fim da playlist. Música inexistente, apagada ou explícita vetada: "music_not_found". */
  add(playlistId: number, musicId: number, includeExplicit: boolean, now?: Date): Promise<AddMusicResult>;

  /** Tira a música da playlist. Devolve false se ela não estava lá (ou se é explícita vetada). */
  remove(playlistId: number, musicId: number, includeExplicit: boolean): Promise<boolean>;

  /**
   * Regrava a ordem: `musicIds` vira a nova sequência. Precisa ter exatamente as músicas ativas e
   * visíveis da playlist, sem faltar nem sobrar; senão nada muda e devolve false (a lista de quem
   * pediu está velha). As músicas apagadas e as explícitas escondidas que ainda estão na tabela
   * vão para o fim, na ordem em que estavam.
   */
  reorder(playlistId: number, musicIds: readonly number[], includeExplicit: boolean): Promise<boolean>;
}
