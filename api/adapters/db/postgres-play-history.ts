import type { Pool } from "pg";
import type { HistoryEntry, ListenedEntry, PlayHistory } from "../../domain/ports/play-history.ts";

interface MusicRow {
  music_id: number;
  name: string;
  duration: number;
  artists: { id: number; name: string }[];
  is_available: boolean;
}

interface HistoryRow extends MusicRow {
  last_played_at: Date;
}

interface ListenedRow extends MusicRow {
  last_listened_at: Date;
}

// Não filtra `m.deleted_at`: a música removida pelo admin continua no histórico de quem a ouviu,
// marcada como indisponível, para a pessoa ver o que ouviu mesmo depois da remoção.
// Os artistas seguem a regra da busca: só os ativos.
const LIST_HISTORY = `
  SELECT m.id AS music_id, m.name, m.duration, credit.artists,
         played.last_played_at, m.deleted_at IS NULL AS is_available
  FROM (
    SELECT e.music_id, max(e.created_at) AS last_played_at
    FROM user_event e
    WHERE e.user_id = $1 AND e.event_type = 'music_play'
    GROUP BY e.music_id
  ) played
  JOIN musics m ON m.id = played.music_id AND ($2 OR NOT m.is_explicit)
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit
  ORDER BY played.last_played_at DESC, m.id`;

// Mesmo formato do histórico, com as marcas de ouvida (HU-15) no lugar das reproduções.
const LIST_LISTENED = `
  SELECT m.id AS music_id, m.name, m.duration, credit.artists,
         listened.last_listened_at, m.deleted_at IS NULL AS is_available
  FROM (
    SELECT e.music_id, max(e.created_at) AS last_listened_at
    FROM user_event e
    WHERE e.user_id = $1 AND e.event_type = 'music_listened'
    GROUP BY e.music_id
  ) listened
  JOIN musics m ON m.id = listened.music_id AND ($2 OR NOT m.is_explicit)
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit
  ORDER BY listened.last_listened_at DESC, m.id`;

// Um comando só, e só para música ativa: a removida não ganha marca nova.
const MARK_LISTENED = `
  INSERT INTO user_event (user_id, event_type, music_id)
  SELECT $1, 'music_listened', id FROM musics WHERE id = $2 AND deleted_at IS NULL`;

function toMusicFields(row: MusicRow) {
  return {
    musicId: row.music_id,
    name: row.name,
    duration: row.duration,
    artists: row.artists,
    isAvailable: row.is_available,
  };
}

export class PostgresPlayHistory implements PlayHistory {
  constructor(private readonly pool: Pool) {}

  async listForUser(userId: number, includeExplicit: boolean): Promise<HistoryEntry[]> {
    const { rows } = await this.pool.query<HistoryRow>(LIST_HISTORY, [userId, includeExplicit]);
    return rows.map((row) => ({ ...toMusicFields(row), lastPlayedAt: row.last_played_at.toISOString() }));
  }

  async markListened(userId: number, musicId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(MARK_LISTENED, [userId, musicId]);
    return rowCount === 1;
  }

  async listListenedForUser(userId: number, includeExplicit: boolean): Promise<ListenedEntry[]> {
    const { rows } = await this.pool.query<ListenedRow>(LIST_LISTENED, [userId, includeExplicit]);
    return rows.map((row) => ({ ...toMusicFields(row), lastListenedAt: row.last_listened_at.toISOString() }));
  }
}
