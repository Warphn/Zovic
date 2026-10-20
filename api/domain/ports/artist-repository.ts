import type { Artist } from "../entities/artist.ts";

export interface ArtistRepository {
  nextId(): Promise<number>;
  save(artist: Artist): Promise<void>;
  /** Só registros ativos: devolve null se não existir ou estiver apagado. */
  findById(id: number): Promise<Artist | null>;
}
