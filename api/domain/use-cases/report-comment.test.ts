import { describe, expect, it } from "bun:test";
import { Comment } from "../entities/comment.ts";
import type { CommentReport } from "../entities/comment-report.ts";
import { BusinessRuleError, ForbiddenError, ValidationError } from "../errors/domain-error.ts";
import type { CommentRepository, CommentWithAuthor } from "../ports/comment-repository.ts";
import type { UserProfile, UserRepository } from "../ports/user-repository.ts";
import { ReportComment } from "./report-comment.ts";

class MockCommentRepository implements CommentRepository {
  readonly comments = new Map<number, Comment>();
  readonly reports: CommentReport[] = [];
  private reportSeq = 0;

  async nextId(): Promise<number> {
    return 1;
  }

  async nextReportId(): Promise<number> {
    this.reportSeq += 1;
    return this.reportSeq;
  }

  async save(comment: Comment): Promise<void> {
    this.comments.set(comment.id, comment);
  }

  async findById(id: number): Promise<Comment | null> {
    return this.comments.get(id) ?? null;
  }

  async listActiveByMusicId(): Promise<CommentWithAuthor[]> {
    return [];
  }

  async softDelete(): Promise<void> {}

  async hasUserReported(commentId: number, userId: number): Promise<boolean> {
    return this.reports.some((r) => r.commentId === commentId && r.userId === userId);
  }

  async saveReport(report: CommentReport): Promise<void> {
    this.reports.push(report);
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
    [2, { id: 2, name: "Denunciante", birthdate: new Date("1992-01-01"), deletedAt: null }],
    [3, { id: 3, name: "Menor", birthdate: new Date("2010-01-01"), deletedAt: null }],
  ]);

  const repo = new MockCommentRepository();
  const c = Comment.create({ id: 10, musicId: 1, userId: 1, comment: "Comentário ofensivo" });
  repo.comments.set(10, c);

  const userRepo = new MockUserRepository(users);
  const useCase = new ReportComment(repo, userRepo);

  return { repo, useCase };
}

describe("ReportComment Use Case", () => {
  it("permite denunciar comentário de outro usuário", async () => {
    const { repo, useCase } = setup();

    const result = await useCase.execute({
      reporterId: 2,
      commentId: 10,
      reason: "Discurso de ódio",
    });

    expect(result).toEqual({ success: true });
    expect(repo.reports).toHaveLength(1);
    expect(repo.reports[0]?.reason).toBe("Discurso de ódio");
  });

  it("impede que o autor denuncie o próprio comentário", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        reporterId: 1,
        commentId: 10,
        reason: "Spam",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("impede denúncias duplicadas do mesmo usuário para o mesmo comentário", async () => {
    const { useCase } = setup();

    await useCase.execute({
      reporterId: 2,
      commentId: 10,
      reason: "Spam",
    });

    const error = await useCase
      .execute({
        reporterId: 2,
        commentId: 10,
        reason: "Spam de novo",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("impede que menor de idade denuncie comentários", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        reporterId: 3,
        commentId: 10,
        reason: "Spam",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("recusa motivo com mais de 280 caracteres", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        reporterId: 2,
        commentId: 10,
        reason: "x".repeat(281),
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
  });
});

