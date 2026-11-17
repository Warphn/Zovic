import type { FileStorage } from "../ports/file-storage.ts";

/** Guarda em memória o que foi gravado e o que foi removido, sem tocar no disco. */
export class InMemoryFileStorage implements FileStorage {
  readonly saved = new Map<string, Uint8Array>();
  readonly removed: string[] = [];

  async save(bytes: Uint8Array, extension: string): Promise<string> {
    const fileName = `file-${this.saved.size + 1}${extension}`;
    this.saved.set(fileName, bytes);
    return fileName;
  }

  async remove(fileName: string): Promise<void> {
    this.removed.push(fileName);
  }
}
