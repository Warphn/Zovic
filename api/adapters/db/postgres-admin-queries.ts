import type { Pool } from "pg";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type {
  AdminQueries,
  AlbumListItem,
  AdminUserItem,
  CatalogQueries,
  MusicListItem,
  PlayLog,
  RecentPlay,
  UsageStats,
} from "../../domain/ports/admin-queries.ts";

/** Quantas músicas entram no ranking de acessos por conteúdo. */
const TOP_CONTENT = 10;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

interface MusicRow {
  id: number;
  name: string;
  duration: number;
  streams: number;
  plays: string;
  artists: { id: number; name: string }[];
  genres: { id: number; name: string; color: string }[];
  album: { id: number; name: string; year: number | null } | null;
  is_explicit: boolean;
  has_audio: boolean;
  created_at: Date;
  deleted_at: Date | null;
}

export class PostgresCatalogQueries implements CatalogQueries, PlayLog {
  constructor(private readonly pool: Pool) {}

  async listMusics({ search, includeDeleted }: { search?: string; includeDeleted: boolean }): Promise<MusicListItem[]> {
    const { rows } = await this.pool.query<MusicRow>(
      `SELECT m.id, m.name, m.duration, m.streams, m.is_explicit, m.audio_file IS NOT NULL AS has_audio,
         m.created_at, m.deleted_at,
         (SELECT json_build_object('id', al.id, 'name', al.name, 'year', al.year)
            FROM album_music amu JOIN album al ON al.id = amu.album_id
            WHERE amu.music_id = m.id AND al.deleted_at IS NULL ORDER BY al.id LIMIT 1) AS album,
         (SELECT count(*) FROM user_event e WHERE e.music_id = m.id AND e.event_type = 'music_play') AS plays,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name)
            FROM artist_music am JOIN artist a ON a.id = am.artist_id WHERE am.music_id = m.id), '[]') AS artists,
         COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color) ORDER BY g.name)
            FROM genre_music gm JOIN genre g ON g.id = gm.genre_id WHERE gm.music_id = m.id), '[]') AS genres
       FROM musics m
       WHERE ($1 OR m.deleted_at IS NULL)
         AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR EXISTS (
           SELECT 1 FROM artist_music am JOIN artist a ON a.id = am.artist_id
           WHERE am.music_id = m.id AND a.name ILIKE '%' || $2 || '%'))
       ORDER BY m.deleted_at IS NOT NULL, m.name, m.id`,
      [includeDeleted, search?.trim() || null],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      duration: row.duration,
      streams: row.streams,
      plays: Number(row.plays),
      artists: row.artists,
      genres: row.genres,
      album: row.album,
      isExplicit: row.is_explicit,
      hasAudio: row.has_audio,
      createdAt: row.created_at.toISOString(),
      deletedAt: iso(row.deleted_at),
    }));
  }

  async listArtists(): Promise<{ id: number; name: string }[]> {
    const { rows } = await this.pool.query<{ id: number; name: string }>(
      "SELECT id, name FROM artist WHERE deleted_at IS NULL ORDER BY name, id",
    );
    return rows;
  }

  async listAlbums(): Promise<AlbumListItem[]> {
    const { rows } = await this.pool.query<Omit<AlbumListItem, "musicCount"> & { music_count: string }>(
      `SELECT al.id, al.name, al.year,
         (SELECT count(*) FROM album_music amu JOIN musics m ON m.id = amu.music_id
            WHERE amu.album_id = al.id AND m.deleted_at IS NULL) AS music_count,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name)
            FROM album_artist aa JOIN artist a ON a.id = aa.artist_id WHERE aa.album_id = al.id), '[]') AS artists
       FROM album al
       WHERE al.deleted_at IS NULL
       ORDER BY al.name, al.id`,
    );
    return rows.map(({ music_count: musicCount, ...album }) => ({ ...album, musicCount: Number(musicCount) }));
  }

  async listGenres(): Promise<{ id: number; name: string; color: string }[]> {
    const { rows } = await this.pool.query<{ id: number; name: string; color: string }>(
      "SELECT id, name, color FROM genre WHERE deleted_at IS NULL ORDER BY name, id",
    );
    return rows;
  }

  async recordPlay(userId: number, musicId: number): Promise<void> {
    // Um comando só: o evento e o contador de streams entram juntos, e só para música ativa.
    const { rowCount } = await this.pool.query(
      `WITH played AS (
         UPDATE musics SET streams = streams + 1 WHERE id = $2 AND deleted_at IS NULL RETURNING id
       )
       INSERT INTO user_event (user_id, event_type, music_id)
       SELECT $1, 'music_play', id FROM played`,
      [userId, musicId],
    );
    if (rowCount === 0) throw new NotFoundError("Music not found");
  }
}

interface UserRow {
  id: number;
  name: string;
  email: string | null;
  role: string;
  birthdate: string | null;
  created_at: Date;
  deleted_at: Date | null;
  plays: string;
  last_play_at: Date | null;
}

export class PostgresAdminQueries implements AdminQueries {
  constructor(private readonly pool: Pool) {}

  async stats(): Promise<UsageStats> {
    const [users, catalog, plays, byContent, byGenre] = await Promise.all([
      this.pool.query<{ active: string; admins: string; deleted: string; recent: string }>(
        `SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS active,
                count(*) FILTER (WHERE deleted_at IS NULL AND role = 'admin') AS admins,
                count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted,
                count(*) FILTER (WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days') AS recent
         FROM "user"`,
      ),
      this.pool.query<{ musics: string; deleted_musics: string; artists: string; playlists: string }>(
        `SELECT (SELECT count(*) FROM musics WHERE deleted_at IS NULL) AS musics,
                (SELECT count(*) FROM musics WHERE deleted_at IS NOT NULL) AS deleted_musics,
                (SELECT count(*) FROM artist WHERE deleted_at IS NULL) AS artists,
                (SELECT count(*) FROM playlists WHERE deleted_at IS NULL) AS playlists`,
      ),
      this.pool.query<{ total: string; recent: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS recent
         FROM user_event WHERE event_type = 'music_play'`,
      ),
      this.pool.query<{ id: number; name: string; artists: string[]; plays: string; streams: number; deleted_at: Date | null }>(
        `SELECT m.id, m.name, m.streams, m.deleted_at, count(*) AS plays,
           ARRAY(SELECT a.name FROM artist_music am JOIN artist a ON a.id = am.artist_id
                 WHERE am.music_id = m.id ORDER BY a.name) AS artists
         FROM user_event e JOIN musics m ON m.id = e.music_id
         WHERE e.event_type = 'music_play'
         GROUP BY m.id
         ORDER BY plays DESC, m.name
         LIMIT $1`,
        [TOP_CONTENT],
      ),
      this.pool.query<{ id: number; name: string; color: string; plays: string }>(
        `SELECT g.id, g.name, g.color, count(e.id) AS plays
         FROM genre g
         LEFT JOIN genre_music gm ON gm.genre_id = g.id
         LEFT JOIN user_event e ON e.music_id = gm.music_id AND e.event_type = 'music_play'
         WHERE g.deleted_at IS NULL
         GROUP BY g.id
         ORDER BY plays DESC, g.name`,
      ),
    ]);
    const u = users.rows[0]!;
    const c = catalog.rows[0]!;
    const p = plays.rows[0]!;
    return {
      users: { active: Number(u.active), admins: Number(u.admins), deleted: Number(u.deleted), newLast30Days: Number(u.recent) },
      catalog: {
        musics: Number(c.musics),
        deletedMusics: Number(c.deleted_musics),
        artists: Number(c.artists),
        playlists: Number(c.playlists),
      },
      plays: { total: Number(p.total), last30Days: Number(p.recent) },
      byContent: byContent.rows.map((row) => ({
        musicId: row.id,
        name: row.name,
        artists: row.artists,
        plays: Number(row.plays),
        streams: row.streams,
        deleted: row.deleted_at !== null,
      })),
      byGenre: byGenre.rows.map((row) => ({ genreId: row.id, name: row.name, color: row.color, plays: Number(row.plays) })),
    };
  }

  async listUsers(search?: string): Promise<AdminUserItem[]> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.id, u.name, u.email, u.role, u.birthdate, u.created_at, u.deleted_at,
         count(e.id) AS plays, max(e.created_at) AS last_play_at
       FROM "user" u
       LEFT JOIN user_event e ON e.user_id = u.id AND e.event_type = 'music_play'
       WHERE $1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
       GROUP BY u.id
       ORDER BY u.deleted_at IS NOT NULL, u.name, u.id`,
      [search?.trim() || null],
    );
    return rows.map(toAdminUser);
  }

  async recentPlays(userId: number, limit: number): Promise<RecentPlay[] | null> {
    const exists = await this.pool.query(`SELECT 1 FROM "user" WHERE id = $1`, [userId]);
    if (exists.rowCount === 0) return null;
    const { rows } = await this.pool.query<{
      music_id: number;
      name: string;
      artists: string[];
      event_type: "music_play" | "music_skip";
      created_at: Date;
      deleted_at: Date | null;
    }>(
      `SELECT e.music_id, m.name, e.event_type, e.created_at, m.deleted_at,
         ARRAY(SELECT a.name FROM artist_music am JOIN artist a ON a.id = am.artist_id
               WHERE am.music_id = m.id ORDER BY a.name) AS artists
       FROM user_event e JOIN musics m ON m.id = e.music_id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((row) => ({
      musicId: row.music_id,
      musicName: row.name,
      artists: row.artists,
      event: row.event_type,
      at: row.created_at.toISOString(),
      musicDeleted: row.deleted_at !== null,
    }));
  }
}

export function toAdminUser(row: UserRow): AdminUserItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "admin" ? "admin" : "assinante",
    birthdate: row.birthdate,
    createdAt: row.created_at.toISOString(),
    deletedAt: iso(row.deleted_at),
    plays: Number(row.plays),
    lastPlayAt: iso(row.last_play_at),
  };
}
