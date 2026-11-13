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
}

export interface AlbumHit {
  id: number;
  name: string;
  /** Nulo só nos álbuns anteriores à coluna. */
  year: number | null;
  /** Caminho da capa na API; nulo nos álbuns antigos, sem capa. */
  coverUrl: string | null;
  /** Artistas ativos do álbum, em ordem alfabética. */
  artists: MusicHitArtist[];
  /** Músicas ativas do álbum. */
  musicCount: number;
}

export interface PlaylistHit {
  id: number;
  name: string;
  isPrivate: boolean;
  color: string | null;
  /** Músicas ativas da playlist. */
  musicCount: number;
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
  /** Esconde as músicas explícitas, inclusive das contagens: quem busca é menor de idade (HU-09). */
  hideExplicit: boolean;
  /** Máximo de itens por grupo. */
  limit: number;
}

/**
 * Busca no catálogo inteiro, sem diferenciar maiúsculas nem acentos. Em cada grupo, primeiro os
 * nomes que começam com o termo, depois os que têm uma palavra começando com ele, depois os que
 * só o contêm; empates em ordem alfabética. Música também é encontrada pelo nome dos artistas;
 * álbum, só pelo nome dele.
 * Playlists: as públicas de qualquer pessoa e as privadas de que `viewerId` é membro.
 * Nada apagado (soft delete) aparece.
 */
export interface SearchQuery {
  search(params: SearchParams): Promise<SearchResults>;
}
