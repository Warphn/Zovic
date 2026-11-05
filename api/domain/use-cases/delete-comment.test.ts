import { describe, expect, it } from "bun:test";
import { Comment } from "../entities/comment.ts";
import type { CommentReport } from "../entities/comment-report.ts";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository, CommentWithAuthor } from "../ports/comment-repository.ts";
import type { UserProfile, UserRepository } from "../ports/user-repository.ts";
import { DeleteComment } from "./delete-comment.ts";

class MockCommentRepository implements CommentRepository {
  readonly items = new Map<number, Comment>();

  async nextId(): Promise<number> {
    return 1;
  }

  async nextReportId(): Promise<number> {
    return 1;
  }

  async save(comment: Comment): Promise<void> {
    this.items.set(comment.id, comment);
  }

  async findById(id: number): Promise<Comment | null> {
    return this.items.get(id) ?? null;
  }

  async listActiveByMusicId(): Promise<CommentWithAuthor[]> {
    return [];
  }

  async softDelete(id: number): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.markAsDeleted();
    }
  }

  async saveReport(_report: CommentReport): Promise<void> {}

  async hasUserReported(): Promise<boolean> {
    return false;
  }

  async getMusicDuration(): Promise<number | null> {
    return null;
  }
}

class MockUserRepository implements UserRepository {
  constructor(private readonly users: Map<number, UserProfile>) {}

  async findById(id: number): Promise<UserProfile | null> {
    return this.users.get(id) ?? null;
  }
}

function setup() {
  const users = new Map<number, UserProfile>([
    [1, { id: 1, name: "Autor", birthdate: new Date("1990-01-01"), deletedAt: null }],
    [2, { id: 2, name: "Outro", birthdate: new Date("1992-01-01"), deletedAt: null }],
  ]);

  const repo = new MockCommentRepository();
  const c1 = Comment.create({ id: 10, musicId: 1, userId: 1, comment: "Meu comentário" });
  repo.items.set(10, c1);

  const userRepo = new MockUserRepository(users);
  const useCase = new DeleteComment(repo, userRepo);

  return { repo, useCase };
}

describe("DeleteComment Use Case", () => {
  it("permite ao autor apagar o próprio comentário", async () => {
    const { repo, useCase } = setup();

    const result = await useCase.execute({ callerId: 1, commentId: 10 });
    expect(result).toEqual({ success: true });

    const comment = await repo.findById(10);
    expect(comment?.isDeleted).toBe(true);
  });

  it("impede que outro usuário apague comentário que não é dele", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ callerId: 2, commentId: 10 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("retorna NotFoundError se o comentário não existir", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ callerId: 1, commentId: 999 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

