// Port de consulta: a busca cruza músicas, artistas, álbuns e playlists e devolve DTOs prontos,
// sem montar entidades (a mesma regra das leituras que atravessam muitas tabelas).

export interface MusicHitArtist {
  id: number;
  name: string;
}

export interface MusicHit {
  id: number;
  name: string;
  /** Segundos. */
  duration: number;
  /** Artistas ativos da música, em ordem alfabética. */
  artists: MusicHitArtist[];
}

export interface ArtistHit {
  id: number;
  name: string;
  /** Músicas ativas do artista. */
  musicCount: number;
  /** Caminho da foto na API; nulo no artista sem foto (HU-36). */
  imageUrl: string | null;
}

export interface AlbumHit {
  id: number;
  name: string;
  year: number | null;
  /** Artistas ativos do álbum, em ordem alfabética. */
  artists: MusicHitArtist[];
  /** Faixas ativas do álbum. */
  musicCount: number;
  /** Caminho da capa na API; nulo no álbum sem capa. */
  coverUrl: string | null;
}

export interface PlaylistHit {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  /** Músicas ativas da playlist. */
  musicCount: number;
  /** Caminho da capa na API; nulo na playlist sem capa (HU-35). */
  coverUrl: string | null;
}

export interface SearchResults {
  musics: MusicHit[];
  artists: ArtistHit[];
  albums: AlbumHit[];
  playlists: PlaylistHit[];
}

export interface SearchParams {
  /** Termo já sem espaços nas pontas e não vazio. */
  term: string;
  /** Quem busca: define quais playlists privadas aparecem. */
  viewerId: number;
  /** Máximo de itens por grupo. */
  limit: number;
  /** Falso para menores de idade (HU-09): as músicas explícitas somem dos resultados e das contagens. */
  includeExplicit: boolean;
}

/**
 * Busca no catálogo inteiro, sem diferenciar maiúsculas nem acentos. Em cada grupo, primeiro os
 * nomes que começam com o termo, depois os que têm uma palavra começando com ele, depois os que
 * só o contêm; empates em ordem alfabética. Música também é encontrada pelo nome dos artistas.
 * Playlists: as públicas de qualquer pessoa e as privadas de que `viewerId` é membro.
 * Nada apagado (soft delete) aparece.
 */
export interface SearchQuery {
  search(params: SearchParams): Promise<SearchResults>;
}
