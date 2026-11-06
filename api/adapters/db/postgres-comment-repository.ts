import type { Pool } from "pg";
import { Comment } from "../../domain/entities/comment.ts";
import type { CommentReport } from "../../domain/entities/comment-report.ts";
import type { CommentRepository, CommentWithAuthor } from "../../domain/ports/comment-repository.ts";

export class PostgresCommentRepository implements CommentRepository {
  constructor(private readonly pool: Pool) {}

  async nextId(): Promise<number> {
    const { rows } = await this.pool.query<{ id: string }>(
      "SELECT nextval(pg_get_serial_sequence('comments', 'id')) AS id",
    );
    const row = rows[0];
    if (!row) {
      throw new Error("Could not reserve a comment id");
    }
    return Number(row.id);
  }

  async nextReportId(): Promise<number> {
    const { rows } = await this.pool.query<{ id: string }>(
      "SELECT nextval(pg_get_serial_sequence('comment_reports', 'id')) AS id",
    );
    const row = rows[0];
    if (!row) {
      throw new Error("Could not reserve a comment report id");
    }
    return Number(row.id);
  }

  async save(comment: Comment): Promise<void> {
    const data = comment.toData();
    await this.pool.query(
      `INSERT INTO comments (id, music_id, user_id, comment, "timestamp", created_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         comment = EXCLUDED.comment,
         "timestamp" = EXCLUDED."timestamp",
         deleted_at = EXCLUDED.deleted_at`,
      [
        data.id,
        data.musicId,
        data.userId,
        data.comment,
        data.timestamp,
        data.createdAt,
        data.deletedAt,
      ],
    );
  }

  async findById(id: number): Promise<Comment | null> {
    const { rows } = await this.pool.query<{
      id: number;
      music_id: number;
      user_id: number;
      comment: string;
      timestamp: number | null;
      created_at: string;
      deleted_at: string | null;
    }>(
      `SELECT id, music_id, user_id, comment, "timestamp", created_at, deleted_at
       FROM comments
       WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return Comment.restore({
      id: row.id,
      musicId: row.music_id,
      userId: row.user_id,
      comment: row.comment,
      timestamp: row.timestamp,
      createdAt: new Date(row.created_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }

  async listActiveByMusicId(musicId: number): Promise<CommentWithAuthor[]> {
    const { rows } = await this.pool.query<{
      id: number;
      music_id: number;
      user_id: number;
      author_name: string;
      author_birthdate: string | null;
      comment: string;
      timestamp: number | null;
      created_at: string;
      deleted_at: string | null;
    }>(
      `SELECT c.id, c.music_id, c.user_id, u.name AS author_name, u.birthdate AS author_birthdate,
              c.comment, c."timestamp", c.created_at, c.deleted_at
       FROM comments c
       JOIN "user" u ON u.id = c.user_id
       WHERE c.music_id = $1 AND c.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [musicId],
    );

    return rows.map((r) => ({
      id: r.id,
      musicId: r.music_id,
      userId: r.user_id,
      authorName: r.author_name,
      authorBirthdate: r.author_birthdate ? new Date(r.author_birthdate) : null,
      comment: r.comment,
      timestamp: r.timestamp,
      createdAt: new Date(r.created_at),
      deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    }));
  }

  async softDelete(id: number, deletedAt = new Date()): Promise<void> {
    await this.pool.query(
      `UPDATE comments SET deleted_at = $1 WHERE id = $2`,
      [deletedAt, id],
    );
  }

  async saveReport(report: CommentReport): Promise<void> {
    const data = report.toData();
    await this.pool.query(
      `INSERT INTO comment_reports (id, comment_id, user_id, reason, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.id, data.commentId, data.userId, data.reason, data.createdAt],
    );
  }

  async hasUserReported(commentId: number, userId: number): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM comment_reports WHERE comment_id = $1 AND user_id = $2 LIMIT 1`,
      [commentId, userId],
    );
    return rows.length > 0;
  }

  async getMusicDuration(musicId: number): Promise<number | null> {
    const { rows } = await this.pool.query<{ duration: number }>(
      `SELECT duration FROM musics WHERE id = $1 AND deleted_at IS NULL`,
      [musicId],
    );
    return rows[0]?.duration ?? null;
  }
}

