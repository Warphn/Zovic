import type { Pool } from "pg";
import { Album } from "../../domain/entities/album.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { AlbumRepository } from "../../domain/ports/album-repository.ts";
import { inTransaction, type LinkTable, nextId, replaceLinks, translateConstraintError } from "./sql.ts";

const ARTISTS: LinkTable = { table: "album_artist", owner: "album_id", other: "artist_id" };
const GENRES: LinkTable = { table: "album_genre", owner: "album_id", other: "genre_id" };

interface AlbumRow {
  id: number;
  name: string;
  year: number | null;
  cover_file: string | null;
  created_at: Date;
  deleted_at: Date | null;
  artist_ids: number[];
  genre_ids: number[];
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
          `INSERT INTO album (id, name, year, cover_file, created_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             year = EXCLUDED.year,
             cover_file = EXCLUDED.cover_file,
             deleted_at = EXCLUDED.deleted_at`,
          [data.id, data.name, data.year, data.coverFile, data.createdAt, data.deletedAt],
        );
        await replaceLinks(client, ARTISTS, data.id, data.artistIds);
        await replaceLinks(client, GENRES, data.id, data.genreIds);
      });
    } catch (error) {
      throw translateConstraintError(error, {
        album_artist_artist_id_fkey: () => new NotFoundError("Artist not found"),
        album_genre_genre_id_fkey: () => new NotFoundError("Genre not found"),
      });
    }
  }

  async findById(id: number): Promise<Album | null> {
    const { rows } = await this.pool.query<AlbumRow>(
      `SELECT a.id, a.name, a.year, a.cover_file, a.created_at, a.deleted_at,
         ARRAY(SELECT artist_id FROM album_artist WHERE album_id = a.id ORDER BY artist_id) AS artist_ids,
         ARRAY(SELECT genre_id FROM album_genre WHERE album_id = a.id ORDER BY genre_id) AS genre_ids
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
          year: row.year,
          coverFile: row.cover_file,
          createdAt: row.created_at,
          deletedAt: row.deleted_at,
        })
      : null;
  }
}
