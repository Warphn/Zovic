import { canSeeExplicit } from "../shared/age.ts";
import type {
  RecommendationCandidate,
  RecommendationSource,
  RecommendedMusic,
  TasteSignal,
} from "../ports/recommendation-source.ts";

/** Quantas músicas a home mostra em "Recomendadas para você". */
export const RECOMMENDATION_COUNT = 10;

export interface RecommendMusicsInput {
  userId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export type RecommendMusicsOutput = RecommendedMusic[];

export interface RecommendMusicsUseCase {
  execute(input: RecommendMusicsInput): Promise<RecommendMusicsOutput>;
}

/** O peso de cada gênero e de cada artista nas músicas que a conta ouviu e curtiu. */
interface TasteProfile {
  genreWeights: Map<number, number>;
  artistWeights: Map<number, number>;
}

function addWeight(weights: Map<number, number>, id: number): void {
  weights.set(id, (weights.get(id) ?? 0) + 1);
}

// Cada música soma 1 em cada gênero e artista dela. A que a conta ouviu e curtiu aparece nas
// duas listas, então pesa 2: curtir reforça o que a audição já mostrou.
function buildProfile(signals: TasteSignal[]): TasteProfile {
  const profile: TasteProfile = { genreWeights: new Map(), artistWeights: new Map() };
  for (const signal of signals) {
    for (const genreId of signal.genreIds) addWeight(profile.genreWeights, genreId);
    for (const artistId of signal.artistIds) addWeight(profile.artistWeights, artistId);
  }
  return profile;
}

function scoreCandidate(candidate: RecommendationCandidate, profile: TasteProfile): number {
  let score = 0;
  for (const genreId of candidate.genreIds) score += profile.genreWeights.get(genreId) ?? 0;
  for (const artist of candidate.artists) score += profile.artistWeights.get(artist.id) ?? 0;
  return score;
}

function toRecommendedMusic({ id, name, duration, artists }: RecommendationCandidate): RecommendedMusic {
  return { id, name, duration, artists };
}

/**
 * Recomendação por conteúdo (HU-25): as músicas ainda não ouvidas com maior pontuação no perfil
 * da conta. Sem histórico, a conta recebe as mais tocadas da plataforma. Menor de idade não
 * recebe músicas explícitas (HU-09).
 */
export class RecommendMusics implements RecommendMusicsUseCase {
  constructor(private readonly source: RecommendationSource) {}

  async execute({ userId, birthdate, now, isAdmin = false }: RecommendMusicsInput): Promise<RecommendMusicsOutput> {
    const includeExplicit = canSeeExplicit(birthdate, now, isAdmin);
    const { listened, liked } = await this.source.listTasteSignals(userId);

    if (listened.length === 0 && liked.length === 0) {
      return this.source.listMostPlayed(RECOMMENDATION_COUNT, includeExplicit);
    }

    const profile = buildProfile([...listened, ...liked]);
    const candidates = await this.source.listCandidates(userId, includeExplicit);
    return candidates
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate, profile) }))
      .toSorted(
        (first, second) =>
          second.score - first.score || second.candidate.streams - first.candidate.streams || first.candidate.id - second.candidate.id,
      )
      .slice(0, RECOMMENDATION_COUNT)
      .map(({ candidate }) => toRecommendedMusic(candidate));
  }
}
