import type { Music } from "../entities/music.ts";

export interface MusicRepository {
  nextId(): Promise<number>;
  save(music: Music): Promise<void>;
  /** Só registros ativos: devolve null se não existir ou estiver apagada. */
  findById(id: number): Promise<Music | null>;
  /** Só as ativas, na ordem dos ids pedidos; ids inexistentes são ignorados. */
  findByIds(ids: number[]): Promise<Music[]>;
}
