import type { Playlist } from "../entities/playlist.ts";

export interface PlaylistRepository {
  nextId(): Promise<number>;
  /**
   * Grava a playlist. Os membros só são gravados quando ela é nova; depois, mudam por `addMember`
   * e `removeMember`. Assim, salvar uma cópia carregada antes (ao renomear, por exemplo) não desfaz
   * quem entrou ou saiu nesse meio-tempo (HU-19).
   */
  save(playlist: Playlist): Promise<void>;
  /** Só playlists ativas: devolve null se não existir ou estiver apagada. */
  findById(id: number): Promise<Playlist | null>;
  /** As playlists ativas de que o usuário é membro, da mais nova para a mais antiga. */
  listByUser(userId: number): Promise<Playlist[]>;
  /** Põe o usuário como membro comum (colaborador). Quem já é membro continua como está. */
  addMember(playlistId: number, userId: number): Promise<void>;
  /** Tira o membro comum. Nunca tira o dono (admin), mesmo se pedido. */
  removeMember(playlistId: number, userId: number): Promise<void>;
}
