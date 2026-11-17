// Os dados que a recomendação por conteúdo (HU-25) lê. A regra de pontuar e ordenar fica no
// caso de uso `RecommendMusics`; aqui só entram as leituras que atravessam várias tabelas.

/** Os gêneros e artistas ativos de uma música que a conta ouviu ou curtiu. */
export interface TasteSignal {
  genreIds: number[];
  artistIds: number[];
}

export interface TasteSignals {
  /** Uma entrada por música com marca de ouvida (HU-15), removida ou não. */
  listened: TasteSignal[];
  /** Uma entrada por música na playlist Músicas Curtidas da conta (HU-20). */
  liked: TasteSignal[];
}

export interface RecommendedMusic {
  id: number;
  name: string;
  /** Segundos. */
  duration: number;
  /** Artistas ativos da música, em ordem alfabética. */
  artists: { id: number; name: string }[];
}

export interface RecommendationCandidate extends RecommendedMusic {
  genreIds: number[];
  /** Quantas vezes a música foi tocada na plataforma; desempata candidatas de mesma pontuação. */
  streams: number;
}

export interface RecommendationSource {
  /** As músicas que a conta ouviu e as que curtiu, cada uma com seus gêneros e artistas ativos. */
  listTasteSignals(userId: number): Promise<TasteSignals>;
  /**
   * As músicas ativas que a conta ainda não ouviu. Com `includeExplicit` falso (menores de
   * idade, HU-09), as explícitas ficam de fora.
   */
  listCandidates(userId: number, includeExplicit: boolean): Promise<RecommendationCandidate[]>;
  /**
   * As músicas ativas mais tocadas da plataforma, da mais para a menos tocada; empate pelo id.
   * Com `includeExplicit` falso, as explícitas ficam de fora.
   */
  listMostPlayed(limit: number, includeExplicit: boolean): Promise<RecommendedMusic[]>;
}
