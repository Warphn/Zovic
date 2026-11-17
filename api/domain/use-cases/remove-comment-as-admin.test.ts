import { describe, expect, it } from "bun:test";
import { Comment } from "../entities/comment.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository, CommentWithAuthor } from "../ports/comment-repository.ts";
import { RemoveCommentAsAdmin } from "./remove-comment-as-admin.ts";

const ADMIN_ID = 1;
const AUTHOR_ID = 2;
const COMMENT_ID = 10;
const REMOVED_COMMENT_ID = 11;

class FakeCommentRepository implements CommentRepository {
  readonly removals: { id: number; deletedBy: number }[] = [];

  constructor(private readonly comments: Map<number, Comment>) {}

  async nextId(): Promise<number> {
    return 1;
  }

  async nextReportId(): Promise<number> {
    return 1;
  }

  async save(): Promise<void> {}

  async findById(id: number): Promise<Comment | null> {
    return this.comments.get(id) ?? null;
  }

  async listActiveByMusicId(): Promise<CommentWithAuthor[]> {
    return [];
  }

  async softDelete(id: number, deletedBy: number): Promise<void> {
    this.removals.push({ id, deletedBy });
  }

  async saveReport(): Promise<void> {}

  async hasUserReported(): Promise<boolean> {
    return false;
  }

  async getMusicDuration(): Promise<number | null> {
    return null;
  }
}

function setup() {
  const removedComment = Comment.restore({
    id: REMOVED_COMMENT_ID,
    musicId: 1,
    userId: AUTHOR_ID,
    comment: "Já removido",
    timestamp: null,
    createdAt: new Date("2026-11-01T12:00:00Z"),
    deletedAt: new Date("2026-11-02T12:00:00Z"),
  });
  const comments = new Map<number, Comment>([
    [COMMENT_ID, Comment.create({ id: COMMENT_ID, musicId: 1, userId: AUTHOR_ID, comment: "Impróprio" })],
    [REMOVED_COMMENT_ID, removedComment],
  ]);
  const repository = new FakeCommentRepository(comments);
  return { repository, removeComment: new RemoveCommentAsAdmin(repository) };
}

describe("RemoveCommentAsAdmin (HU-23)", () => {
  it("remove o comentário de outra pessoa e registra o admin que removeu", async () => {
    const { repository, removeComment } = setup();

    await removeComment.execute({ adminId: ADMIN_ID, commentId: COMMENT_ID });

    expect(repository.removals).toEqual([{ id: COMMENT_ID, deletedBy: ADMIN_ID }]);
  });

  it("comentário inexistente ou já removido dá NotFoundError", async () => {
    const { repository, removeComment } = setup();

    const missingError = await removeComment.execute({ adminId: ADMIN_ID, commentId: 99 }).catch((caught: unknown) => caught);
    const removedError = await removeComment
      .execute({ adminId: ADMIN_ID, commentId: REMOVED_COMMENT_ID })
      .catch((caught: unknown) => caught);

    expect(missingError).toBeInstanceOf(NotFoundError);
    expect(removedError).toBeInstanceOf(NotFoundError);
    expect(repository.removals).toEqual([]);
  });
});
