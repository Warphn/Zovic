import { describe, expect, it } from "bun:test";
import { Music } from "../entities/music.ts";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { MusicRepository } from "../ports/music-repository.ts";
import { GetMusicAudio } from "./get-music-audio.ts";

const NOW = new Date("2026-11-06T15:00:00Z");
const ADULT = "1995-03-12";
const MINOR = "2010-01-01";
const TURNS_18_TODAY = "2008-11-06";
const AUDIO_FILE = "faixa.mp3";

/** Só as músicas ativas: uma removida não está no mapa, como o repositório real não a devolve. */
class InMemoryMusics implements MusicRepository {
  readonly items = new Map<number, Music>();

  async nextId(): Promise<number> {
    return this.items.size + 1;
  }

  async save(music: Music): Promise<void> {
    this.items.set(music.id, music);
  }

  async findById(id: number): Promise<Music | null> {
    return this.items.get(id) ?? null;
  }

  async findByIds(ids: number[]): Promise<Music[]> {
    return ids.flatMap((id) => this.items.get(id) ?? []);
  }
}

function makeMusic(id: number, isExplicit = false): Music {
  return Music.create({ id, name: `Música ${id}`, duration: 180, artistIds: [1], audioFile: AUDIO_FILE, isExplicit });
}

function makeUseCase(...musics: Music[]): GetMusicAudio {
  const repository = new InMemoryMusics();
  for (const music of musics) repository.items.set(music.id, music);
  return new GetMusicAudio(repository);
}

describe("GetMusicAudio", () => {
  it("entrega o arquivo da música ativa", async () => {
    const output = await makeUseCase(makeMusic(1)).execute({ musicId: 1, birthdate: ADULT, now: NOW });

    expect(output).toEqual({ audioFile: AUDIO_FILE });
  });

  it("recusa a música inexistente ou removida", async () => {
    const failure = await makeUseCase().execute({ musicId: 1, birthdate: ADULT, now: NOW }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(NotFoundError);
  });

  it("recusa a música sem arquivo de áudio", async () => {
    const withoutAudio = Music.restore({ ...makeMusic(1).toData(), audioFile: null });

    const failure = await makeUseCase(withoutAudio).execute({ musicId: 1, birthdate: ADULT, now: NOW }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(NotFoundError);
  });

  it("recusa a música explícita para menor de idade", async () => {
    const failure = await makeUseCase(makeMusic(1, true))
      .execute({ musicId: 1, birthdate: MINOR, now: NOW })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ForbiddenError);
    expect(failure).toHaveProperty("message", "Música explícita: só para maiores de 18 anos");
  });

  it("recusa a música explícita sem data de nascimento", async () => {
    const failure = await makeUseCase(makeMusic(1, true))
      .execute({ musicId: 1, birthdate: null, now: NOW })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ForbiddenError);
  });

  it("entrega a música explícita para quem faz 18 anos hoje", async () => {
    const output = await makeUseCase(makeMusic(1, true)).execute({ musicId: 1, birthdate: TURNS_18_TODAY, now: NOW });

    expect(output).toEqual({ audioFile: AUDIO_FILE });
  });

  it("entrega a música não explícita para menor de idade", async () => {
    const output = await makeUseCase(makeMusic(1)).execute({ musicId: 1, birthdate: MINOR, now: NOW });

    expect(output).toEqual({ audioFile: AUDIO_FILE });
  });
});
