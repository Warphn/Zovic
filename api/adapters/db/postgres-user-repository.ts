import type { Pool } from "pg";
import type { UserProfile, UserRepository } from "../../domain/ports/user-repository.ts";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: number): Promise<UserProfile | null> {
    const { rows } = await this.pool.query<{
      id: number;
      name: string;
      birthdate: string | null;
      deleted_at: string | null;
    }>(
      `SELECT id, name, birthdate, deleted_at FROM "user" WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      birthdate: row.birthdate ? new Date(row.birthdate) : null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    };
  }
}

