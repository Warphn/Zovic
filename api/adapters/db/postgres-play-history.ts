import type { Pool } from "pg";
import type { HistoryEntry, PlayHistory } from "../../domain/ports/play-history.ts";

interface HistoryRow {
  music_id: number;
  name: string;
  duration: number;
  artists: { id: number; name: string }[];
  last_played_at: Date;
  is_available: boolean;
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
  JOIN musics m ON m.id = played.music_id
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit
  ORDER BY played.last_played_at DESC, m.id`;

export class PostgresPlayHistory implements PlayHistory {
  constructor(private readonly pool: Pool) {}

  async listForUser(userId: number): Promise<HistoryEntry[]> {
    const { rows } = await this.pool.query<HistoryRow>(LIST_HISTORY, [userId]);
    return rows.map((row) => ({
      musicId: row.music_id,
      name: row.name,
      duration: row.duration,
      artists: row.artists,
      lastPlayedAt: row.last_played_at.toISOString(),
      isAvailable: row.is_available,
    }));
  }
}
