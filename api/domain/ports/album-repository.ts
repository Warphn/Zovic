import type { Album } from "../entities/album.ts";

export interface AlbumRepository {
  nextId(): Promise<number>;
  save(album: Album): Promise<void>;
  /** Só registros ativos: devolve null se não existir ou estiver apagado. */
  findById(id: number): Promise<Album | null>;
}
