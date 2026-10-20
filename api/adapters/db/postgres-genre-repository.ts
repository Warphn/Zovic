import type { Pool } from "pg";
import { Genre } from "../../domain/entities/genre.ts";
import { BusinessRuleError } from "../../domain/errors/domain-error.ts";
import type { GenreRepository } from "../../domain/ports/genre-repository.ts";
import { nextId, translateConstraintError } from "./sql.ts";

interface GenreRow {
  id: number;
  name: string;
  color: string;
  created_at: Date;
  deleted_at: Date | null;
}

export class PostgresGenreRepository implements GenreRepository {
  constructor(private readonly pool: Pool) {}

  nextId(): Promise<number> {
    return nextId(this.pool, "genre");
  }

  async save(genre: Genre): Promise<void> {
    const data = genre.toData();
    try {
      await this.pool.query(
        `INSERT INTO genre (id, name, color, created_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           color = EXCLUDED.color,
           deleted_at = EXCLUDED.deleted_at`,
        [data.id, data.name, data.color, data.createdAt, data.deletedAt],
      );
    } catch (error) {
      throw translateConstraintError(error, {
        genre_name_key: () => new BusinessRuleError("A genre with this name already exists"),
      });
    }
  }

  async findById(id: number): Promise<Genre | null> {
    const { rows } = await this.pool.query<GenreRow>(
      "SELECT id, name, color, created_at, deleted_at FROM genre WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    const row = rows[0];
    return row
      ? Genre.restore({ id: row.id, name: row.name, color: row.color, createdAt: row.created_at, deletedAt: row.deleted_at })
      : null;
  }
}
