import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AudioStorage } from "../../domain/ports/audio-storage.ts";

const AUDIO_EXTENSION = ".mp3";

/**
 * Guarda os áudios num diretório do disco (AUDIO_DIR). O nome do arquivo é sempre gerado
 * aqui: o nome enviado pelo admin é descartado, o que evita caminho malicioso e colisão.
 */
export class LocalAudioStorage implements AudioStorage {
  constructor(private readonly directory: string) {}

  async save(bytes: Uint8Array): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const fileName = `${crypto.randomUUID()}${AUDIO_EXTENSION}`;
    await Bun.write(join(this.directory, fileName), bytes);
    return fileName;
  }

  async remove(fileName: string): Promise<void> {
    await rm(join(this.directory, fileName), { force: true });
  }
}
