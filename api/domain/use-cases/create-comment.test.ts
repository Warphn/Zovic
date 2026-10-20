import { describe, expect, it } from "bun:test";
import type { Comment } from "../entities/comment.ts";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/domain-error.ts";
import type { CommentRepository, CommentWithAuthor } from "../ports/comment-repository.ts";
import type { UserProfile, UserRepository } from "../ports/user-repository.ts";
import { CreateComment } from "./create-comment.ts";

class InMemoryCommentRepository implements CommentRepository {
  readonly items: Comment[] = [];
  private lastId = 0;

  async nextId(): Promise<number> {
    this.lastId += 1;
    return this.lastId;
  }

  async nextReportId(): Promise<number> {
    return 1;
  }

  async save(comment: Comment): Promise<void> {
    this.items.push(comment);
  }

  async findById(id: number): Promise<Comment | null> {
    return this.items.find((c) => c.id === id) ?? null;
  }

  async listActiveByMusicId(): Promise<CommentWithAuthor[]> {
    return [];
  }

  async softDelete(): Promise<void> {}
  async saveReport(): Promise<void> {}
  async hasUserReported(): Promise<boolean> {
    return false;
  }

  async getMusicDuration(musicId: number): Promise<number | null> {
    return musicId === 999 ? 240 : null;
  }
}

class InMemoryUserRepository implements UserRepository {
  constructor(private readonly users: Map<number, UserProfile>) {}

  async findById(id: number): Promise<UserProfile | null> {
    return this.users.get(id) ?? null;
  }
}

function setup() {
  const usersMap = new Map<number, UserProfile>([
    [1, { id: 1, name: "Adulto", birthdate: new Date("1995-05-10"), deletedAt: null }],
    [2, { id: 2, name: "Menor", birthdate: new Date("2012-01-01"), deletedAt: null }],
    [3, { id: 3, name: "Sem Nascimento", birthdate: null, deletedAt: null }],
    [4, { id: 4, name: "Apagado", birthdate: new Date("1990-01-01"), deletedAt: new Date() }],
  ]);
  const commentsRepo = new InMemoryCommentRepository();
  const usersRepo = new InMemoryUserRepository(usersMap);
  const useCase = new CreateComment(commentsRepo, usersRepo);

  return { commentsRepo, usersRepo, useCase };
}

describe("CreateComment Use Case", () => {
  it("cria comentário para usuário adulto", async () => {
    const { commentsRepo, useCase } = setup();

    const output = await useCase.execute({
      userId: 1,
      musicId: 10,
      comment: "Que som massa!",
      timestamp: 45,
    });

    expect(output).toMatchObject({
      id: 1,
      musicId: 10,
      userId: 1,
      comment: "Que som massa!",
      timestamp: 45,
    });
    expect(commentsRepo.items).toHaveLength(1);
  });

  it("impede que menor de idade comente", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        userId: 2,
        musicId: 10,
        comment: "Comentário de menor",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("trata usuário com birthdate vazio/nulo como menor e bloqueia comentário", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        userId: 3,
        musicId: 10,
        comment: "Comentário sem nascimento",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("falha com NotFoundError se o usuário não existir ou estiver deletado", async () => {
    const { useCase } = setup();

    const notFound = await useCase
      .execute({
        userId: 99,
        musicId: 10,
        comment: "Inexistente",
      })
      .catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(NotFoundError);

    const deleted = await useCase
      .execute({
        userId: 4,
        musicId: 10,
        comment: "Apagado",
      })
      .catch((e: unknown) => e);
    expect(deleted).toBeInstanceOf(NotFoundError);
  });

  it("rejeita comentário com mais de 280 caracteres", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({
        userId: 1,
        musicId: 10,
        comment: "x".repeat(281),
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
  });
});

