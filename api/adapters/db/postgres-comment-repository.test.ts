import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Comment } from "../../domain/entities/comment.ts";
import { CommentReport } from "../../domain/entities/comment-report.ts";
import { PostgresCommentRepository } from "./postgres-comment-repository.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repository = new PostgresCommentRepository(pool);

let testUserId: number;
let otherUserId: number;
let testMusicId: number;
const createdCommentIds: number[] = [];

beforeAll(async () => {
  // Cria usuários de teste
  const u1 = await pool.query<{ id: number }>(
    `INSERT INTO "user" (name, birthdate) VALUES ('Test Adult', '1995-01-01') RETURNING id`,
  );
  testUserId = u1.rows[0]!.id;

  const u2 = await pool.query<{ id: number }>(
    `INSERT INTO "user" (name, birthdate) VALUES ('Test Other', '1992-05-10') RETURNING id`,
  );
  otherUserId = u2.rows[0]!.id;

  // Cria música de teste
  const m = await pool.query<{ id: number }>(
    `INSERT INTO musics (name, duration) VALUES ('Test Track', 210) RETURNING id`,
  );
  testMusicId = m.rows[0]!.id;
});

afterAll(async () => {
  if (createdCommentIds.length > 0) {
    await pool.query("DELETE FROM comment_reports WHERE comment_id = ANY($1::integer[])", [createdCommentIds]);
    await pool.query("DELETE FROM comments WHERE id = ANY($1::integer[])", [createdCommentIds]);
  }
  await pool.query("DELETE FROM musics WHERE id = $1", [testMusicId]);
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::integer[])`, [[testUserId, otherUserId]]);
  await pool.end();
});

describe("PostgresCommentRepository", () => {
  it("salva comentário com timestamp e lista nos ativos", async () => {
    const id = await repository.nextId();
    createdCommentIds.push(id);

    const comment = Comment.create({
      id,
      musicId: testMusicId,
      userId: testUserId,
      comment: "Comentário com tempo",
      timestamp: 42,
    });

    await repository.save(comment);

    const list = await repository.listActiveByMusicId(testMusicId);
    const found = list.find((c) => c.id === id);

    expect(found).toBeDefined();
    expect(found?.comment).toBe("Comentário com tempo");
    expect(found?.timestamp).toBe(42);
    expect(found?.authorName).toBe("Test Adult");
  });

  it("salva comentário sem timestamp (nulo)", async () => {
    const id = await repository.nextId();
    createdCommentIds.push(id);

    const comment = Comment.create({
      id,
      musicId: testMusicId,
      userId: testUserId,
      comment: "Sem sincronização",
    });

    await repository.save(comment);

    const list = await repository.listActiveByMusicId(testMusicId);
    const found = list.find((c) => c.id === id);

    expect(found).toBeDefined();
    expect(found?.timestamp).toBeNull();
  });

  it("permite soft delete de um comentário", async () => {
    const id = await repository.nextId();
    createdCommentIds.push(id);

    const comment = Comment.create({
      id,
      musicId: testMusicId,
      userId: testUserId,
      comment: "Será apagado",
    });
    await repository.save(comment);

    await repository.softDelete(id);

    const list = await repository.listActiveByMusicId(testMusicId);
    expect(list.some((c) => c.id === id)).toBe(false);

    const loaded = await repository.findById(id);
    expect(loaded?.isDeleted).toBe(true);
  });

  it("registra denúncia e verifica duplicidade", async () => {
    const id = await repository.nextId();
    createdCommentIds.push(id);

    const comment = Comment.create({
      id,
      musicId: testMusicId,
      userId: testUserId,
      comment: "Para ser denunciado",
    });
    await repository.save(comment);

    const reportId = await repository.nextReportId();
    const report = CommentReport.create({
      id: reportId,
      commentId: id,
      userId: otherUserId,
      commentAuthorId: testUserId,
      reason: "Spam",
    });

    expect(await repository.hasUserReported(id, otherUserId)).toBe(false);

    await repository.saveReport(report);

    expect(await repository.hasUserReported(id, otherUserId)).toBe(true);
  });
});

