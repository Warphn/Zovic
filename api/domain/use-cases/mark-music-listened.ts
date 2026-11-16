import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import type { PlayHistory } from "../ports/play-history.ts";

/** Uma música conta como ouvida quando toca por mais que isto numa mesma reprodução (HU-15). */
export const LISTENED_THRESHOLD_SECONDS = 30;

export interface MarkMusicListenedInput {
  userId: number;
  musicId: number;
  /** Segundos de som tocados nesta reprodução, contados pelo player. */
  playedSeconds: number;
}

export interface MarkMusicListenedUseCase {
  execute(input: MarkMusicListenedInput): Promise<void>;
}

export class MarkMusicListened implements MarkMusicListenedUseCase {
  constructor(private readonly history: PlayHistory) {}

  async execute({ userId, musicId, playedSeconds }: MarkMusicListenedInput): Promise<void> {
    if (playedSeconds <= LISTENED_THRESHOLD_SECONDS) {
      throw new BusinessRuleError(`A music counts as listened only after more than ${LISTENED_THRESHOLD_SECONDS} seconds`);
    }
    const isMarked = await this.history.markListened(userId, musicId);
    if (!isMarked) throw new NotFoundError("Music not found");
  }
}
