/** Onde ficam os arquivos enviados pelo painel (áudios e capas). O domínio só conhece o nome devolvido. */
export interface FileStorage {
  /** Grava o arquivo e devolve o nome com que ele foi guardado, com a extensão pedida (como ".mp3"). */
  save(bytes: Uint8Array, extension: string): Promise<string>;
  /** Apaga o arquivo; um nome que não existe não é erro. */
  remove(fileName: string): Promise<void>;
}
