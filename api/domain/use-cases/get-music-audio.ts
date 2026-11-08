import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { MusicRepository } from "../ports/music-repository.ts";
import { calendarDateIn, isAdult, TIME_ZONE } from "../shared/age.ts";

export interface GetMusicAudioInput {
  musicId: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
}

export interface GetMusicAudioOutput {
  /** Nome do arquivo no armazenamento de áudio. */
  audioFile: string;
}

/** Decide se o áudio de uma música pode ser entregue a quem pede (HU-13). */
export class GetMusicAudio {
  constructor(private readonly musics: MusicRepository) {}

  async execute({ musicId, birthdate, now }: GetMusicAudioInput): Promise<GetMusicAudioOutput> {
    const music = await this.musics.findById(musicId);
    // O 404 vem antes do 403, para não revelar que existe um arquivo que a pessoa não pode ouvir.
    if (!music || music.audioFile === null) throw new NotFoundError("Audio not found");
    if (music.isExplicit && !isAdult(birthdate, calendarDateIn(now, TIME_ZONE))) {
      throw new ForbiddenError("Música explícita: só para maiores de 18 anos");
    }
    return { audioFile: music.audioFile };
  }
}
