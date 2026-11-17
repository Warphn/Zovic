import { DatabaseError, type Pool } from "pg";
import { Playlist } from "../../domain/entities/playlist.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { PlaylistRepository } from "../../domain/ports/playlist-repository.ts";

const FOREIGN_KEY_VIOLATION = "23503";

interface PlaylistRow {
  id: number;
  name: string;
  is_private: boolean;
  color: string | null;
  created_at: Date;
  deleted_at: Date | null;
  liked_by_user_id: number | null;
  cover_file: string | null;
  member_ids: number[];
  member_is_admin: boolean[];
}

// Os membros vêm na mesma linha, em dois arrays na mesma ordem (por user_id).
const SELECT_ACTIVE = `
  SELECT p.id, p.name, p.is_private, p.color, p.created_at, p.deleted_at, p.liked_by_user_id, p.cover_file,
    ARRAY(SELECT user_id FROM playlist_user WHERE playlist_id = p.id ORDER BY user_id) AS member_ids,
    ARRAY(SELECT is_admin FROM playlist_user WHERE playlist_id = p.id ORDER BY user_id) AS member_is_admin
  FROM playlists p
  WHERE p.deleted_at IS NULL`;

export class PostgresPlaylistRepository implements PlaylistRepository {
  constructor(private readonly pool: Pool) {}

  async nextId(): Promise<number> {
    const { rows } = await this.pool.query<{ id: string }>(
      "SELECT nextval(pg_get_serial_sequence('playlists', 'id')) AS id",
    );
    const row = rows[0];
    if (!row) {
      throw new Error("Could not reserve a playlist id");
    }
    return Number(row.id);
  }

  async save(playlist: Playlist): Promise<void> {
    const data = playlist.toData();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      // `xmax = 0` só na linha recém-inserida: diz se a playlist é nova ou foi atualizada
      const { rows } = await client.query<{ is_new: boolean }>(
        `INSERT INTO playlists (id, name, is_private, color, created_at, deleted_at, liked_by_user_id, cover_file)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           is_private = EXCLUDED.is_private,
           color = EXCLUDED.color,
           deleted_at = EXCLUDED.deleted_at,
           cover_file = EXCLUDED.cover_file
         RETURNING xmax = 0 AS is_new`,
        [
          data.id,
          data.name,
          data.isPrivate,
          data.color,
          data.createdAt,
          data.deletedAt,
          data.likedByUserId ?? null,
          data.coverFile ?? null,
        ],
      );
      // Os membros só entram na criação: uma cópia antiga salva depois (ao renomear, por
      // exemplo) não pode desfazer quem entrou ou saiu por addMember e removeMember (HU-19)
      if (rows[0]?.is_new) {
        await client.query(
          `INSERT INTO playlist_user (playlist_id, user_id, is_admin)
           SELECT $1, member.user_id, member.is_admin
           FROM unnest($2::integer[], $3::boolean[]) AS member(user_id, is_admin)`,
          [data.id, data.members.map((member) => member.userId), data.members.map((member) => member.isAdmin)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw translateError(error);
    } finally {
      client.release();
    }
  }

  async findById(id: number): Promise<Playlist | null> {
    const { rows } = await this.pool.query<PlaylistRow>(`${SELECT_ACTIVE} AND p.id = $1`, [id]);
    const row = rows[0];
    return row ? toPlaylist(row) : null;
  }

  async listByUser(userId: number): Promise<Playlist[]> {
    const { rows } = await this.pool.query<PlaylistRow>(
      `${SELECT_ACTIVE}
         AND EXISTS (SELECT 1 FROM playlist_user WHERE playlist_id = p.id AND user_id = $1)
       ORDER BY p.created_at DESC, p.id DESC`,
      [userId],
    );
    return rows.map(toPlaylist);
  }

  // Uma linha só, sem regravar os outros membros: duas mudanças ao mesmo tempo não se desfazem
  async addMember(playlistId: number, userId: number): Promise<void> {
    await this.pool
      .query(
        `INSERT INTO playlist_user (playlist_id, user_id, is_admin) VALUES ($1, $2, false)
         ON CONFLICT (playlist_id, user_id) DO NOTHING`,
        [playlistId, userId],
      )
      .catch((error: unknown) => {
        throw translateError(error);
      });
  }

  async findLikedSongs(userId: number): Promise<Playlist | null> {
    const { rows } = await this.pool.query<PlaylistRow>(`${SELECT_ACTIVE} AND p.liked_by_user_id = $1`, [userId]);
    const row = rows[0];
    return row ? toPlaylist(row) : null;
  }

  // O UNIQUE de liked_by_user_id decide quem cria: a chamada que perde não insere nada e lê a que ficou
  async createLikedSongs(playlist: Playlist): Promise<Playlist> {
    const data = playlist.toData();
    const ownerId = data.likedByUserId;
    if (ownerId === undefined || ownerId === null) throw new Error("Not a Músicas Curtidas playlist");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO playlists (id, name, is_private, color, created_at, liked_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (liked_by_user_id) DO NOTHING`,
        [data.id, data.name, data.isPrivate, data.color, data.createdAt, ownerId],
      );
      if (inserted.rowCount === 1) {
        await client.query("INSERT INTO playlist_user (playlist_id, user_id, is_admin) VALUES ($1, $2, true)", [
          data.id,
          ownerId,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw translateError(error);
    } finally {
      client.release();
    }
    const created = await this.findLikedSongs(ownerId);
    if (!created) throw new Error("Músicas Curtidas was not created");
    return created;
  }

  async removeMember(playlistId: number, userId: number): Promise<void> {
    await this.pool.query("DELETE FROM playlist_user WHERE playlist_id = $1 AND user_id = $2 AND NOT is_admin", [
      playlistId,
      userId,
    ]);
  }
}

function toPlaylist(row: PlaylistRow): Playlist {
  return Playlist.restore({
    id: row.id,
    name: row.name,
    isPrivate: row.is_private,
    color: row.color,
    members: row.member_ids.map((userId, index) => ({ userId, isAdmin: row.member_is_admin[index] ?? false })),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    likedByUserId: row.liked_by_user_id,
    coverFile: row.cover_file,
  });
}

function translateError(error: unknown): unknown {
  if (
    error instanceof DatabaseError &&
    error.code === FOREIGN_KEY_VIOLATION &&
    error.constraint === "playlist_user_user_id_fkey"
  ) {
    return new NotFoundError("User not found");
  }
  return error;
}
