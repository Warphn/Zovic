import { NotFoundError } from "../errors/domain-error.ts";
import { canSeeExplicit } from "../shared/age.ts";
import type { MusicDislikes } from "../ports/music-dislikes.ts";
import type { UnlikeMusicUseCase } from "./liked-songs.ts";

// O dislike da HU-20. Cada conta tem um voto por música: o dislike tira o like, e o LikeMusic
// tira o dislike. A recomendação (HU-25) não sugere as músicas com dislike.

export interface DislikedMusicInput {
  userId: number;
  musicId: number;
}

export interface DislikeMusicInput extends DislikedMusicInput {
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export interface DislikeMusicUseCase {
  execute(input: DislikeMusicInput): Promise<void>;
}

/**
 * Grava o dislike e tira a música da Músicas Curtidas. Dar dislike de novo não muda nada. Para
 * menor de idade, a explícita é NotFoundError, como se não existisse (HU-09).
 */
export class DislikeMusic implements DislikeMusicUseCase {
  constructor(
    private readonly dislikes: MusicDislikes,
    private readonly unlikeMusic: UnlikeMusicUseCase,
  ) {}

  async execute({ userId, musicId, birthdate, now, isAdmin }: DislikeMusicInput): Promise<void> {
    const includeExplicit = canSeeExplicit(birthdate, now, isAdmin);
    const isAdded = await this.dislikes.add(userId, musicId, includeExplicit);
    if (!isAdded) throw new NotFoundError("Music not found");
    await this.unlikeMusic.execute({ userId, musicId });
  }
}

export interface RemoveDislikeUseCase {
  execute(input: DislikedMusicInput): Promise<void>;
}

/** Tira o dislike. Tirar o que não existe não é erro, nem para a explícita que a conta não vê mais. */
export class RemoveDislike implements RemoveDislikeUseCase {
  constructor(private readonly dislikes: MusicDislikes) {}

  async execute({ userId, musicId }: DislikedMusicInput): Promise<void> {
    await this.dislikes.remove(userId, musicId);
  }
}

export interface ListMyDislikedMusicsInput {
  userId: number;
}

export interface ListMyDislikedMusicsUseCase {
  execute(input: ListMyDislikedMusicsInput): Promise<number[]>;
}

/** Os ids das músicas com dislike da conta, do mais recente para o mais antigo. */
export class ListMyDislikedMusics implements ListMyDislikedMusicsUseCase {
  constructor(private readonly dislikes: MusicDislikes) {}

  execute({ userId }: ListMyDislikedMusicsInput): Promise<number[]> {
    return this.dislikes.listMusicIds(userId);
  }
}
