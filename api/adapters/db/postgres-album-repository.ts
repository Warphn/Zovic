import type { Pool } from "pg";
import { Album } from "../../domain/entities/album.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { AlbumRepository } from "../../domain/ports/album-repository.ts";
import { inTransaction, type LinkTable, nextId, replaceLinks, translateConstraintError } from "./sql.ts";

const ARTISTS: LinkTable = { table: "album_artist", owner: "album_id", other: "artist_id" };
const GENRES: LinkTable = { table: "album_genre", owner: "album_id", other: "genre_id" };
const MUSICS: LinkTable = { table: "album_music", owner: "album_id", other: "music_id" };

interface AlbumRow {
  id: number;
  name: string;
  created_at: Date;
  deleted_at: Date | null;
  artist_ids: number[];
  genre_ids: number[];
  music_ids: number[];
}

export class PostgresAlbumRepository implements AlbumRepository {
  constructor(private readonly pool: Pool) {}

  nextId(): Promise<number> {
    return nextId(this.pool, "album");
  }

  async save(album: Album): Promise<void> {
    const data = album.toData();
    try {
      await inTransaction(this.pool, async (client) => {
        await client.query(
          `INSERT INTO album (id, name, created_at, deleted_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             deleted_at = EXCLUDED.deleted_at`,
          [data.id, data.name, data.createdAt, data.deletedAt],
        );
        await replaceLinks(client, ARTISTS, data.id, data.artistIds);
        await replaceLinks(client, GENRES, data.id, data.genreIds);
        await replaceLinks(client, MUSICS, data.id, data.musicIds);
      });
    } catch (error) {
      throw translateConstraintError(error, {
        album_artist_artist_id_fkey: () => new NotFoundError("Artist not found"),
        album_genre_genre_id_fkey: () => new NotFoundError("Genre not found"),
        album_music_music_id_fkey: () => new NotFoundError("Music not found"),
      });
    }
  }

  async findById(id: number): Promise<Album | null> {
    const { rows } = await this.pool.query<AlbumRow>(
      `SELECT a.id, a.name, a.created_at, a.deleted_at,
         ARRAY(SELECT artist_id FROM album_artist WHERE album_id = a.id ORDER BY artist_id) AS artist_ids,
         ARRAY(SELECT genre_id FROM album_genre WHERE album_id = a.id ORDER BY genre_id) AS genre_ids,
         ARRAY(SELECT music_id FROM album_music WHERE album_id = a.id ORDER BY music_id) AS music_ids
       FROM album a
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    return row
      ? Album.restore({
          id: row.id,
          name: row.name,
          artistIds: row.artist_ids,
          genreIds: row.genre_ids,
          musicIds: row.music_ids,
          createdAt: row.created_at,
          deletedAt: row.deleted_at,
        })
      : null;
  }
}
