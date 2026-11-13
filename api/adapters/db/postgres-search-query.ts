import type { Pool } from "pg";
import type {
  ArtistHit,
  MusicHit,
  MusicHitArtist,
  PlaylistHit,
  SearchParams,
  SearchQuery,
  SearchResults,
} from "../../domain/ports/search-query.ts";

interface MusicRow {
  id: number;
  name: string;
  duration: number;
  artists: MusicHitArtist[];
}

interface ArtistRow {
  id: number;
  name: string;
  music_count: number;
}

interface PlaylistRow {
  id: number;
  name: string;
  is_private: boolean;
  color: string | null;
  music_count: number;
}

// Em todas as consultas, $1 é o termo já com os curingas do LIKE escapados, $2 é o limite. Em músicas e artistas, $3
// diz se as músicas explícitas entram (falso para menores de idade); em playlists, $3 é quem busca e $4 é esse mesmo aviso.
// `q.t` é o termo normalizado e `s.h` é o texto onde se procura, normalizado do mesmo jeito.
const TERM = String.raw`CROSS JOIN (SELECT lower(unaccent($1::text)) AS t) q`;
const MATCHES = String.raw`s.h LIKE '%' || q.t || '%' ESCAPE '\'`;
// 0: o texto começa com o termo; 1: uma palavra começa com ele (separadores iguais aos do
// front: espaço , . - & /); 2: o termo está no meio de uma palavra.
const RANK = String.raw`CASE
    WHEN s.h LIKE q.t || '%' ESCAPE '\' THEN 0
    WHEN ' ' || regexp_replace(s.h, '[[:space:],.&/-]+', ' ', 'g') LIKE '% ' || q.t || '%' ESCAPE '\' THEN 1
    ELSE 2
  END`;

const SEARCH_MUSICS = `
  SELECT m.id, m.name, m.duration, credit.artists
  FROM musics m
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists,
           string_agg(a.name, ' ' ORDER BY a.name, a.id) AS names
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit
  CROSS JOIN LATERAL (SELECT lower(unaccent(m.name || coalesce(' ' || credit.names, ''))) AS h) s
  ${TERM}
  WHERE m.deleted_at IS NULL AND ($3 OR NOT m.is_explicit) AND ${MATCHES}
  ORDER BY ${RANK}, lower(unaccent(m.name)), m.id
  LIMIT $2`;

const SEARCH_ARTISTS = `
  SELECT a.id, a.name,
         (SELECT count(*)::int
          FROM artist_music am
          JOIN musics m ON m.id = am.music_id AND m.deleted_at IS NULL
          WHERE am.artist_id = a.id AND ($3 OR NOT m.is_explicit)) AS music_count
  FROM artist a
  CROSS JOIN LATERAL (SELECT lower(unaccent(a.name)) AS h) s
  ${TERM}
  WHERE a.deleted_at IS NULL AND ${MATCHES}
  ORDER BY ${RANK}, s.h, a.id
  LIMIT $2`;

// Mesma regra de visibilidade do GET /playlists/:id: públicas, ou privadas de que $3 é membro.
const SEARCH_PLAYLISTS = `
  SELECT p.id, p.name, p.is_private, p.color,
         (SELECT count(*)::int
          FROM music_playlist mp
          JOIN musics m ON m.id = mp.music_id AND m.deleted_at IS NULL
          WHERE mp.playlist_id = p.id AND ($4 OR NOT m.is_explicit)) AS music_count
  FROM playlists p
  CROSS JOIN LATERAL (SELECT lower(unaccent(p.name)) AS h) s
  ${TERM}
  WHERE p.deleted_at IS NULL
    AND (NOT p.is_private
         OR EXISTS (SELECT 1 FROM playlist_user pu WHERE pu.playlist_id = p.id AND pu.user_id = $3))
    AND ${MATCHES}
  ORDER BY ${RANK}, s.h, p.id
  LIMIT $2`;

/** `%` e `_` digitados são texto, não curinga: buscar "%" não pode devolver o catálogo inteiro. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, String.raw`\$&`);
}

export class PostgresSearchQuery implements SearchQuery {
  constructor(private readonly pool: Pool) {}

  async search({ term, viewerId, limit, includeExplicit }: SearchParams): Promise<SearchResults> {
    const pattern = escapeLike(term);
    const [musics, artists, playlists] = await Promise.all([
      this.pool.query<MusicRow>(SEARCH_MUSICS, [pattern, limit, includeExplicit]),
      this.pool.query<ArtistRow>(SEARCH_ARTISTS, [pattern, limit, includeExplicit]),
      this.pool.query<PlaylistRow>(SEARCH_PLAYLISTS, [pattern, limit, viewerId, includeExplicit]),
    ]);

    return {
      musics: musics.rows.map(toMusicHit),
      artists: artists.rows.map(toArtistHit),
      playlists: playlists.rows.map(toPlaylistHit),
    };
  }
}

function toMusicHit(row: MusicRow): MusicHit {
  return { id: row.id, name: row.name, duration: row.duration, artists: row.artists };
}

function toArtistHit(row: ArtistRow): ArtistHit {
  return { id: row.id, name: row.name, musicCount: row.music_count };
}

function toPlaylistHit(row: PlaylistRow): PlaylistHit {
  return { id: row.id, name: row.name, isPrivate: row.is_private, color: row.color, musicCount: row.music_count };
}
