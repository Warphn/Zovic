import { NotFoundError } from "../errors/domain-error.ts";
import type { MusicRepository } from "../ports/music-repository.ts";
import { canSeeExplicit } from "../shared/age.ts";

export interface GetMusicAudioInput {
  musicId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  isAdmin?: boolean;
}

export interface GetMusicAudioOutput {
  /** Nome do arquivo no armazenamento de áudio. */
  audioFile: string;
}

/** Decide se o áudio de uma música pode ser entregue a quem pede (HU-13). */
export class GetMusicAudio {
  constructor(private readonly musics: MusicRepository) {}

  async execute({ musicId, birthdate, now, isAdmin = false }: GetMusicAudioInput): Promise<GetMusicAudioOutput> {
    const music = await this.musics.findById(musicId);
    // A explícita para menor dá o mesmo 404 da música sem áudio, para não revelar que ela existe.
    if (!music || music.audioFile === null) throw new NotFoundError("Audio not found");
    if (music.isExplicit && !canSeeExplicit(birthdate, now, isAdmin)) throw new NotFoundError("Audio not found");
    return { audioFile: music.audioFile };
  }
}
