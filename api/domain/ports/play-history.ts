// Consulta do histórico de reprodução: cruza eventos, músicas e artistas e devolve DTOs prontos,
// como as outras leituras que atravessam várias tabelas.

export interface HistoryEntry {
  musicId: number;
  name: string;
  /** Segundos. */
  duration: number;
  /** Artistas ativos da música, em ordem alfabética. */
  artists: { id: number; name: string }[];
  /** Quando a música foi ouvida pela última vez (ISO). */
  lastPlayedAt: string;
  /** False se o admin removeu a música do catálogo depois de ela ser ouvida. */
  isAvailable: boolean;
}

/** Uma música que a conta ouviu por mais de 30 segundos numa reprodução (HU-15). */
export interface ListenedEntry extends Omit<HistoryEntry, "lastPlayedAt"> {
  /** Quando a música passou dos 30 segundos pela última vez (ISO). */
  lastListenedAt: string;
}

export interface PlayHistory {
  /**
   * As músicas que a conta ouviu, cada uma uma vez, com a data da última reprodução, da mais
   * recente para a mais antiga. Música removida pelo admin continua na lista, com `isAvailable` falso.
   */
  listForUser(userId: number): Promise<HistoryEntry[]>;
  /** Grava a marca de ouvida. Devolve false se a música não existe ou foi removida. */
  markListened(userId: number, musicId: number): Promise<boolean>;
  /**
   * As músicas marcadas como ouvidas pela conta, cada uma uma vez, da marca mais recente para a
   * mais antiga. Música removida pelo admin continua na lista, com `isAvailable` falso.
   */
  listListenedForUser(userId: number): Promise<ListenedEntry[]>;
}
