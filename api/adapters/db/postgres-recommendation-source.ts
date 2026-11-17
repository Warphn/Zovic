import type { Pool } from "pg";
import type {
  RecommendationCandidate,
  RecommendationSource,
  RecommendedMusic,
  TasteSignal,
  TasteSignals,
} from "../../domain/ports/recommendation-source.ts";

interface TasteRow {
  genre_ids: number[];
  artist_ids: number[];
}

interface MusicRow {
  id: number;
  name: string;
  duration: number;
  artists: { id: number; name: string }[];
}

interface CandidateRow extends MusicRow {
  genre_ids: number[];
  streams: number;
}

// Só gêneros e artistas ativos entram no perfil e na pontuação, como na busca.
const ACTIVE_GENRE_IDS = `
  ARRAY(
    SELECT gm.genre_id FROM genre_music gm
    JOIN genre g ON g.id = gm.genre_id AND g.deleted_at IS NULL
    WHERE gm.music_id = m.id
  )`;

const ACTIVE_ARTIST_IDS = `
  ARRAY(
    SELECT am.artist_id FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  )`;

const ACTIVE_ARTISTS = `
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit`;

// A música removida pelo admin continua contando para o perfil: a conta a ouviu mesmo assim.
const LIST_LISTENED_SIGNALS = `
  SELECT ${ACTIVE_GENRE_IDS} AS genre_ids, ${ACTIVE_ARTIST_IDS} AS artist_ids
  FROM musics m
  WHERE m.id IN (
    SELECT e.music_id FROM user_event e WHERE e.user_id = $1 AND e.event_type = 'music_listened'
  )`;

// A curtida é a música estar na playlist Músicas Curtidas da conta (HU-34).
const LIST_LIKED_SIGNALS = `
  SELECT ${ACTIVE_GENRE_IDS} AS genre_ids, ${ACTIVE_ARTIST_IDS} AS artist_ids
  FROM musics m
  JOIN music_playlist mp ON mp.music_id = m.id
  JOIN playlists p ON p.id = mp.playlist_id AND p.liked_by_user_id = $1 AND p.deleted_at IS NULL`;

// A música com dislike da conta (HU-20) nunca é recomendada, nem na lista das mais tocadas.
const NOT_DISLIKED = `
  NOT EXISTS (SELECT 1 FROM music_dislikes d WHERE d.user_id = $1 AND d.music_id = m.id)`;

const LIST_CANDIDATES = `
  SELECT m.id, m.name, m.duration, m.streams, credit.artists, ${ACTIVE_GENRE_IDS} AS genre_ids
  FROM musics m
  ${ACTIVE_ARTISTS}
  WHERE m.deleted_at IS NULL
    AND ($2 OR NOT m.is_explicit)
    AND ${NOT_DISLIKED}
    AND NOT EXISTS (
      SELECT 1 FROM user_event e WHERE e.user_id = $1 AND e.event_type = 'music_listened' AND e.music_id = m.id
    )`;

const LIST_MOST_PLAYED = `
  SELECT m.id, m.name, m.duration, credit.artists
  FROM musics m
  ${ACTIVE_ARTISTS}
  WHERE m.deleted_at IS NULL AND ($3 OR NOT m.is_explicit) AND ${NOT_DISLIKED}
  ORDER BY m.streams DESC, m.id
  LIMIT $2`;

function toTasteSignal(row: TasteRow): TasteSignal {
  return { genreIds: row.genre_ids, artistIds: row.artist_ids };
}

function toRecommendedMusic(row: MusicRow): RecommendedMusic {
  return { id: row.id, name: row.name, duration: row.duration, artists: row.artists };
}

export class PostgresRecommendationSource implements RecommendationSource {
  constructor(private readonly pool: Pool) {}

  async listTasteSignals(userId: number): Promise<TasteSignals> {
    const [listened, liked] = await Promise.all([
      this.pool.query<TasteRow>(LIST_LISTENED_SIGNALS, [userId]),
      this.pool.query<TasteRow>(LIST_LIKED_SIGNALS, [userId]),
    ]);
    return { listened: listened.rows.map(toTasteSignal), liked: liked.rows.map(toTasteSignal) };
  }

  async listCandidates(userId: number, includeExplicit: boolean): Promise<RecommendationCandidate[]> {
    const { rows } = await this.pool.query<CandidateRow>(LIST_CANDIDATES, [userId, includeExplicit]);
    return rows.map((row) => ({ ...toRecommendedMusic(row), genreIds: row.genre_ids, streams: row.streams }));
  }

  async listMostPlayed(userId: number, limit: number, includeExplicit: boolean): Promise<RecommendedMusic[]> {
    const { rows } = await this.pool.query<MusicRow>(LIST_MOST_PLAYED, [userId, limit, includeExplicit]);
    return rows.map(toRecommendedMusic);
  }
}
