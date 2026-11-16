import type { Pool } from "pg";
import type { UserEmailLookup, UserProfile, UserRepository } from "../../domain/ports/user-repository.ts";

interface UserRow {
  id: number;
  name: string;
  birthdate: string | null;
  deleted_at: string | null;
}

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    birthdate: row.birthdate ? new Date(row.birthdate) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

export class PostgresUserRepository implements UserRepository, UserEmailLookup {
  constructor(private readonly pool: Pool) {}

  async findById(id: number): Promise<UserProfile | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT id, name, birthdate, deleted_at FROM "user" WHERE id = $1`, [id]);
    const row = rows[0];
    return row ? toProfile(row) : null;
  }

  // O email é guardado sempre em minúsculas; a conta removida continua com ele, mas não é achada
  async findByEmail(email: string): Promise<UserProfile | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, name, birthdate, deleted_at FROM "user" WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    const row = rows[0];
    return row ? toProfile(row) : null;
  }
}

