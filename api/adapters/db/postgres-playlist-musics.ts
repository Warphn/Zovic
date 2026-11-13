import type { Pool, PoolClient } from "pg";
import type { AddMusicResult, PlaylistMusicItem, PlaylistMusics } from "../../domain/ports/playlist-musics.ts";
import { inTransaction } from "./sql.ts";

interface PlaylistMusicRow {
  id: number;
  name: string;
  duration: number;
  added_at: Date;
  artists: { id: number; name: string }[];
  album: { id: number; name: string } | null;
}

const LIST = `
  SELECT m.id, m.name, m.duration, mp.added_at, credit.artists, first_album.album
  FROM music_playlist mp
  JOIN musics m ON m.id = mp.music_id AND m.deleted_at IS NULL
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id), '[]') AS artists
    FROM artist_music am
    JOIN artist a ON a.id = am.artist_id AND a.deleted_at IS NULL
    WHERE am.music_id = m.id
  ) credit
  -- Música e álbum são N:N: vale o álbum ativo de menor id.
  LEFT JOIN LATERAL (
    SELECT json_build_object('id', al.id, 'name', al.name) AS album
    FROM album_music alm
    JOIN album al ON al.id = alm.album_id AND al.deleted_at IS NULL
    WHERE alm.music_id = m.id
    ORDER BY al.id
    LIMIT 1
  ) first_album ON true
  WHERE mp.playlist_id = $1 AND ($2 OR NOT m.is_explicit)
  ORDER BY mp.position, mp.music_id`;

// A nova sequência: primeiro os ids pedidos, na ordem pedida; depois as músicas que não vieram
// (apagadas ou explícitas escondidas de menor), na ordem em que estavam. O UNIQUE (playlist_id, position) é DEFERRABLE,
// então trocar as posições num UPDATE só não esbarra em posição repetida no meio do caminho.
const REORDER = `
  UPDATE music_playlist mp
  SET position = ordered.position
  FROM (
    SELECT music_id, row_number() OVER (ORDER BY grp, ord) - 1 AS position
    FROM (
      SELECT t.music_id, 0 AS grp, t.ord
      FROM unnest($2::integer[]) WITH ORDINALITY AS t(music_id, ord)
      UNION ALL
      SELECT rest.music_id, 1, rest.position
      FROM music_playlist rest
      WHERE rest.playlist_id = $1 AND rest.music_id <> ALL($2::integer[])
    ) sequence
  ) ordered
  WHERE mp.playlist_id = $1 AND mp.music_id = ordered.music_id`;

/**
 * Trava a linha da playlist até o fim da transação: duas inclusões ao mesmo tempo calculariam a
 * mesma posição no fim, e uma reordenação poderia conferir a lista antes de outra mudança gravar.
 */
async function lockPlaylist(client: PoolClient, playlistId: number): Promise<void> {
  await client.query("SELECT 1 FROM playlists WHERE id = $1 FOR UPDATE", [playlistId]);
}

export class PostgresPlaylistMusics implements PlaylistMusics {
  constructor(private readonly pool: Pool) {}

  async list(playlistId: number, includeExplicit: boolean): Promise<PlaylistMusicItem[]> {
    const { rows } = await this.pool.query<PlaylistMusicRow>(LIST, [playlistId, includeExplicit]);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      duration: row.duration,
      artists: row.artists,
      album: row.album,
      addedAt: row.added_at.toISOString(),
    }));
  }

  async add(playlistId: number, musicId: number, includeExplicit: boolean, now: Date = new Date()): Promise<AddMusicResult> {
    let result: AddMusicResult = "added";
    await inTransaction(this.pool, async (client) => {
      await lockPlaylist(client, playlistId);

      const music = await client.query(
        "SELECT 1 FROM musics WHERE id = $1 AND deleted_at IS NULL AND ($2 OR NOT is_explicit)",
        [musicId, includeExplicit],
      );
      if (music.rowCount === 0) {
        result = "music_not_found";
        return;
      }

      const inserted = await client.query(
        `INSERT INTO music_playlist (music_id, playlist_id, position, added_at)
         SELECT $2, $1, coalesce(max(position) + 1, 0), $3 FROM music_playlist WHERE playlist_id = $1
         ON CONFLICT (music_id, playlist_id) DO NOTHING`,
        [playlistId, musicId, now],
      );
      if (inserted.rowCount === 0) result = "already_in_playlist";
    });
    return result;
  }

  async remove(playlistId: number, musicId: number, includeExplicit: boolean): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM music_playlist mp
       USING musics m
       WHERE mp.playlist_id = $1 AND mp.music_id = $2 AND m.id = mp.music_id AND ($3 OR NOT m.is_explicit)`,
      [playlistId, musicId, includeExplicit],
    );
    return (rowCount ?? 0) > 0;
  }

  async reorder(playlistId: number, musicIds: readonly number[], includeExplicit: boolean): Promise<boolean> {
    let matches = false;
    await inTransaction(this.pool, async (client) => {
      await lockPlaylist(client, playlistId);

      const { rows } = await client.query<{ music_id: number }>(
        `SELECT mp.music_id
         FROM music_playlist mp
         JOIN musics m ON m.id = mp.music_id AND m.deleted_at IS NULL
         WHERE mp.playlist_id = $1 AND ($2 OR NOT m.is_explicit)`,
        [playlistId, includeExplicit],
      );
      const current = new Set(rows.map((row) => row.music_id));
      // Mesmo tamanho, sem repetição e todos presentes: é exatamente o mesmo conjunto.
      matches =
        current.size === musicIds.length &&
        new Set(musicIds).size === musicIds.length &&
        musicIds.every((id) => current.has(id));
      if (!matches) return;

      await client.query(REORDER, [playlistId, musicIds]);
    });
    return matches;
  }
}
