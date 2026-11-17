// Os dislikes de cada conta (HU-20). O like continua sendo a música estar na Músicas Curtidas (HU-34).

export interface MusicDislikes {
  /** Os ids das músicas com dislike da conta, do dislike mais recente para o mais antigo. */
  listMusicIds(userId: number): Promise<number[]>;
  /**
   * Grava o dislike. Dar dislike de novo não muda nada. Devolve false se a música não existe, foi
   * removida ou, com `includeExplicit` falso (menores de idade, HU-09), é explícita.
   */
  add(userId: number, musicId: number, includeExplicit: boolean): Promise<boolean>;
  /** Tira o dislike. Tirar o que não existe não é erro. */
  remove(userId: number, musicId: number): Promise<void>;
}
