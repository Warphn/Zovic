import type { ListenedEntry, PlayHistory } from "../ports/play-history.ts";

export interface ListMyListenedMusicsInput {
  userId: number;
}

export type ListMyListenedMusicsOutput = ListenedEntry[];

export interface ListMyListenedMusicsUseCase {
  execute(input: ListMyListenedMusicsInput): Promise<ListMyListenedMusicsOutput>;
}

export class ListMyListenedMusics implements ListMyListenedMusicsUseCase {
  constructor(private readonly history: PlayHistory) {}

  execute({ userId }: ListMyListenedMusicsInput): Promise<ListMyListenedMusicsOutput> {
    return this.history.listListenedForUser(userId);
  }
}
