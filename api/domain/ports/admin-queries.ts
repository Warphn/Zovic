/**
 * Leituras do catálogo e do painel de admin. São consultas prontas para a tela (listas,
 * agregados), sem regra de negócio, por isso não passam pelas entidades.
 */

export interface MusicListItem {
  id: number;
  name: string;
  /** Segundos. */
  duration: number;
  streams: number;
  /** Reproduções registradas em user_event (music_play). */
  plays: number;
  artists: { id: number; name: string }[];
  genres: { id: number; name: string; color: string }[];
  /** O álbum ativo da música, ou null se ela não está em nenhum. */
  album: { id: number; name: string; year: number | null; trackNumber: number } | null;
  isExplicit: boolean;
  /** As músicas anteriores ao upload não têm arquivo de áudio. */
  hasAudio: boolean;
  createdAt: string;
  /** Preenchido só nas removidas, que só admins enxergam. */
  deletedAt: string | null;
}

export interface AlbumListItem {
  id: number;
  name: string;
  year: number | null;
  artists: { id: number; name: string }[];
  /** Faixas ativas do álbum. */
  musicCount: number;
  /** Endereço da capa (GET /api/albums/:id/cover), com a versão no fim; null nos álbuns sem capa. */
  coverUrl: string | null;
}

export interface ArtistListItem {
  id: number;
  name: string;
  /** Endereço da foto (GET /api/artists/:id/image), com a versão no fim; null no artista sem foto (HU-36). */
  imageUrl: string | null;
}

export interface CatalogQueries {
  /**
   * Ativas, por nome; com includeDeleted, também as removidas (só para admins). Sem includeExplicit,
   * as músicas explícitas ficam de fora (menores de idade, HU-09).
   */
  listMusics(options: { search?: string; includeDeleted: boolean; includeExplicit: boolean }): Promise<MusicListItem[]>;
  listArtists(): Promise<ArtistListItem[]>;
  /** Álbuns ativos, por nome; sem includeExplicit, a contagem de faixas ignora as explícitas. */
  listAlbums(options: { includeExplicit: boolean }): Promise<AlbumListItem[]>;
  /** O arquivo da capa de um álbum ativo; null se ele não existe, foi removido ou não tem capa. */
  findAlbumCoverFile(albumId: number): Promise<string | null>;
  /** O arquivo da foto de um artista ativo; null se ele não existe, foi removido ou não tem foto. */
  findArtistImageFile(artistId: number): Promise<string | null>;
  listGenres(): Promise<{ id: number; name: string; color: string }[]>;
}

export interface PlayLog {
  /**
   * Registra que o usuário tocou a música; recusa música inexistente ou removida, e a explícita
   * quando `includeExplicit` é falso (o mesmo 404, para não revelar que ela existe).
   */
  recordPlay(userId: number, musicId: number, includeExplicit: boolean): Promise<void>;
}

export interface AdminUserItem {
  id: number;
  name: string;
  email: string | null;
  role: "admin" | "assinante";
  birthdate: string | null;
  createdAt: string;
  deletedAt: string | null;
  plays: number;
  lastPlayAt: string | null;
}

export interface RecentPlay {
  musicId: number;
  musicName: string;
  artists: string[];
  event: "music_play" | "music_skip";
  at: string;
  musicDeleted: boolean;
}

export interface UsageStats {
  users: { active: number; admins: number; deleted: number; newLast30Days: number };
  catalog: { musics: number; deletedMusics: number; artists: number; playlists: number };
  plays: { total: number; last30Days: number };
  /** Músicas mais acessadas (reproduções), da mais para a menos tocada. */
  byContent: { musicId: number; name: string; artists: string[]; plays: number; streams: number; deleted: boolean }[];
  /** Reproduções por gênero; uma música com dois gêneros conta nos dois. */
  byGenre: { genreId: number; name: string; color: string; plays: number }[];
}

/** Um comentário ativo com pelo menos uma denúncia, para a moderação (HU-39). */
export interface ReportedCommentItem {
  id: number;
  comment: string;
  /** Segundo da música a que o comentário se refere, ou null. */
  timestamp: number | null;
  createdAt: string;
  author: { id: number; name: string };
  music: { id: number; name: string };
  reportCount: number;
  /** Da denúncia mais recente para a mais antiga. */
  reports: { reason: string; reporterName: string; createdAt: string }[];
}

export interface AdminQueries {
  stats(): Promise<UsageStats>;
  /** Todos os usuários, inclusive removidos; search filtra por nome ou email. */
  listUsers(search?: string): Promise<AdminUserItem[]>;
  /** Últimas reproduções do usuário, da mais recente para a mais antiga; null se ele não existe. */
  recentPlays(userId: number, limit: number): Promise<RecentPlay[] | null>;
  /** Comentários ativos denunciados, dos mais denunciados para os menos; no empate, a denúncia mais recente primeiro. */
  listReportedComments(): Promise<ReportedCommentItem[]>;
}

export interface NewAccountInput {
  name: string;
  email: string;
  password: string;
  /** AAAA-MM-DD. */
  birthdate: string;
  role: "admin" | "assinante";
}

export interface UserAccounts {
  /** Cria o usuário com login por email e senha; recusa email já usado. */
  create(input: NewAccountInput): Promise<AdminUserItem>;
  find(id: number): Promise<{ id: number; role: "admin" | "assinante"; deletedAt: Date | null } | null>;
  countActiveAdmins(): Promise<number>;
  /** Soft delete e encerra as sessões abertas. */
  remove(id: number): Promise<void>;
}
