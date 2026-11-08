import type { Genre } from "../entities/genre.ts";

export interface GenreRepository {
  nextId(): Promise<number>;
  save(genre: Genre): Promise<void>;
  /** Só registros ativos: devolve null se não existir ou estiver apagado. */
  findById(id: number): Promise<Genre | null>;
}
