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

export interface PlayHistory {
  /**
   * As músicas que a conta ouviu, cada uma uma vez, com a data da última reprodução, da mais
   * recente para a mais antiga. Música removida pelo admin continua na lista, com `isAvailable` falso.
   */
  listForUser(userId: number): Promise<HistoryEntry[]>;
}
