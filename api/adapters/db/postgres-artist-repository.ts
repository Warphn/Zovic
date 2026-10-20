import type { Pool } from "pg";
import { Artist } from "../../domain/entities/artist.ts";
import type { ArtistRepository } from "../../domain/ports/artist-repository.ts";
import { nextId } from "./sql.ts";

interface ArtistRow {
  id: number;
  name: string;
  created_at: Date;
  deleted_at: Date | null;
}

export class PostgresArtistRepository implements ArtistRepository {
  constructor(private readonly pool: Pool) {}

  nextId(): Promise<number> {
    return nextId(this.pool, "artist");
  }

  async save(artist: Artist): Promise<void> {
    const data = artist.toData();
    await this.pool.query(
      `INSERT INTO artist (id, name, created_at, deleted_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         deleted_at = EXCLUDED.deleted_at`,
      [data.id, data.name, data.createdAt, data.deletedAt],
    );
  }

  async findById(id: number): Promise<Artist | null> {
    const { rows } = await this.pool.query<ArtistRow>(
      "SELECT id, name, created_at, deleted_at FROM artist WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    const row = rows[0];
    return row ? Artist.restore({ id: row.id, name: row.name, createdAt: row.created_at, deletedAt: row.deleted_at }) : null;
  }
}
