import { canSeeExplicit } from "../shared/age.ts";
import type { HistoryEntry, PlayHistory } from "../ports/play-history.ts";

export interface ListMyHistoryInput {
  userId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export type ListMyHistoryOutput = HistoryEntry[];

export interface ListMyHistoryUseCase {
  execute(input: ListMyHistoryInput): Promise<ListMyHistoryOutput>;
}

/** Menor de idade não vê as músicas explícitas que ouviu antes de a regra valer (HU-09). */
export class ListMyHistory implements ListMyHistoryUseCase {
  constructor(private readonly history: PlayHistory) {}

  execute({ userId, birthdate, now, isAdmin = false }: ListMyHistoryInput): Promise<ListMyHistoryOutput> {
    return this.history.listForUser(userId, canSeeExplicit(birthdate, now, isAdmin));
  }
}
