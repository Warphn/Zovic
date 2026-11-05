/** Onde ficam os arquivos de áudio das músicas. O domínio só conhece o nome devolvido. */
export interface AudioStorage {
  /** Grava o arquivo e devolve o nome com que ele foi guardado. */
  save(bytes: Uint8Array): Promise<string>;
  /** Apaga o arquivo; um nome que não existe não é erro. */
  remove(fileName: string): Promise<void>;
}
