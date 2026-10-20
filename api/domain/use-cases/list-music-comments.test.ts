import { describe, expect, it } from "bun:test";
import type { Comment } from "../entities/comment.ts";
import type { CommentReport } from "../entities/comment-report.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository, CommentWithAuthor } from "../ports/comment-repository.ts";
import type { UserProfile, UserRepository } from "../ports/user-repository.ts";
import { ListMusicComments } from "./list-music-comments.ts";

class MockCommentRepository implements CommentRepository {
  constructor(private readonly data: CommentWithAuthor[]) {}

  async nextId(): Promise<number> {
    return 1;
  }

  async nextReportId(): Promise<number> {
    return 1;
  }

  async save(_comment: Comment): Promise<void> {}

  async findById(_id: number): Promise<Comment | null> {
    return null;
  }

  async listActiveByMusicId(musicId: number): Promise<CommentWithAuthor[]> {
    return this.data.filter((c) => c.musicId === musicId && !c.deletedAt);
  }

  async softDelete(_id: number): Promise<void> {}

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
    [1, { id: 1, name: "Adulto", birthdate: new Date("1995-03-12"), deletedAt: null }],
    [2, { id: 2, name: "Menor", birthdate: new Date("2010-06-28"), deletedAt: null }],
    [3, { id: 3, name: "Sem Data", birthdate: null, deletedAt: null }],
  ]);

  const comments: CommentWithAuthor[] = [
    {
      id: 101,
      musicId: 5,
      userId: 1,
      authorName: "Adulto",
      authorBirthdate: new Date("1995-03-12"),
      comment: "Que refrão!",
      timestamp: 45,
      createdAt: new Date("2026-10-15T10:00:00Z"),
      deletedAt: null,
    },
    {
      id: 102,
      musicId: 5,
      userId: 8,
      authorName: "Outro Usuário",
      authorBirthdate: new Date("1990-01-01"),
      comment: "Muito boa a mixagem.",
      timestamp: null,
      createdAt: new Date("2026-10-15T11:00:00Z"),
      deletedAt: null,
    },
    {
      id: 103,
      musicId: 5,
      userId: 1,
      authorName: "Adulto",
      authorBirthdate: new Date("1995-03-12"),
      comment: "Comentário apagado",
      timestamp: null,
      createdAt: new Date("2026-10-15T12:00:00Z"),
      deletedAt: new Date("2026-10-16T12:00:00Z"),
    },
  ];

  const repo = new MockCommentRepository(comments);
  const userRepo = new MockUserRepository(users);
  const useCase = new ListMusicComments(repo, userRepo);

  return { useCase };
}

describe("ListMusicComments Use Case", () => {
  it("permite que usuário adulto visualize todos os comentários ativos", async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ viewerId: 1, musicId: 5 });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 101,
      authorName: "Adulto",
      comment: "Que refrão!",
      timestamp: 45,
      isMine: true,
    });
    expect(result[1]).toMatchObject({
      id: 102,
      authorName: "Outro Usuário",
      comment: "Muito boa a mixagem.",
      timestamp: null,
      isMine: false,
    });
  });

  it("retorna lista vazia para usuário menor de idade (sem visualização de comentários)", async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ viewerId: 2, musicId: 5 });

    expect(result).toEqual([]);
  });

  it("retorna lista vazia para usuário com birthdate nulo", async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ viewerId: 3, musicId: 5 });

    expect(result).toEqual([]);
  });

  it("lança NotFoundError se o usuário visualizador não existir", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ viewerId: 999, musicId: 5 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

