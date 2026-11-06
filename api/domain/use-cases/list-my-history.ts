import type { HistoryEntry, PlayHistory } from "../ports/play-history.ts";

export interface ListMyHistoryInput {
  userId: number;
}

export type ListMyHistoryOutput = HistoryEntry[];

export interface ListMyHistoryUseCase {
  execute(input: ListMyHistoryInput): Promise<ListMyHistoryOutput>;
}

export class ListMyHistory implements ListMyHistoryUseCase {
  constructor(private readonly history: PlayHistory) {}

  execute({ userId }: ListMyHistoryInput): Promise<ListMyHistoryOutput> {
    return this.history.listForUser(userId);
  }
}
