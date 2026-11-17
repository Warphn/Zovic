import { canSeeExplicit } from "../shared/age.ts";
import type { ListenedEntry, PlayHistory } from "../ports/play-history.ts";

export interface ListMyListenedMusicsInput {
  userId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export type ListMyListenedMusicsOutput = ListenedEntry[];

export interface ListMyListenedMusicsUseCase {
  execute(input: ListMyListenedMusicsInput): Promise<ListMyListenedMusicsOutput>;
}

/** Menor de idade não vê as músicas explícitas que marcou como ouvidas (HU-09), como no histórico. */
export class ListMyListenedMusics implements ListMyListenedMusicsUseCase {
  constructor(private readonly history: PlayHistory) {}

  execute({ userId, birthdate, now, isAdmin = false }: ListMyListenedMusicsInput): Promise<ListMyListenedMusicsOutput> {
    return this.history.listListenedForUser(userId, canSeeExplicit(birthdate, now, isAdmin));
  }
}
