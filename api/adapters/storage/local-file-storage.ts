import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { FileStorage } from "../../domain/ports/file-storage.ts";

/**
 * Guarda os arquivos num diretório do disco (AUDIO_DIR, COVER_DIR). O nome é sempre gerado
 * aqui: o nome enviado pelo admin é descartado, o que evita caminho malicioso e colisão.
 */
export class LocalFileStorage implements FileStorage {
  constructor(private readonly directory: string) {}

  async save(bytes: Uint8Array, extension: string): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const fileName = `${crypto.randomUUID()}${extension}`;
    await Bun.write(join(this.directory, fileName), bytes);
    return fileName;
  }

  /** O caminho no disco, para a rota que entrega o arquivo. `fileName` vem do banco, nunca do cliente. */
  pathOf(fileName: string): string {
    return join(this.directory, fileName);
  }

  async remove(fileName: string): Promise<void> {
    await rm(join(this.directory, fileName), { force: true });
  }
}
