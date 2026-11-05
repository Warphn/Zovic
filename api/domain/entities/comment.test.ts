import { describe, expect, it } from "bun:test";
import { ValidationError } from "../errors/domain-error.ts";
import { Comment } from "./comment.ts";

describe("Comment Entity", () => {
  it("cria comentário válido sem sincronização (timestamp nulo)", () => {
    const comment = Comment.create({
      id: 1,
      musicId: 10,
      userId: 5,
      comment: "Música incrível!",
    });

    expect(comment.id).toBe(1);
    expect(comment.musicId).toBe(10);
    expect(comment.userId).toBe(5);
    expect(comment.comment).toBe("Música incrível!");
    expect(comment.timestamp).toBeNull();
    expect(comment.deletedAt).toBeNull();
    expect(comment.isDeleted).toBe(false);
  });

  it("cria comentário com timestamp válido", () => {
    const comment = Comment.create({
      id: 2,
      musicId: 10,
      userId: 5,
      comment: "A melhor parte é esse solo aqui!",
      timestamp: 75,
      musicDuration: 200,
    });

    expect(comment.timestamp).toBe(75);
  });

  it("remove espaços em branco nas pontas do comentário", () => {
    const comment = Comment.create({
      id: 3,
      musicId: 10,
      userId: 5,
      comment: "   Letra muito emocionante.   ",
    });

    expect(comment.comment).toBe("Letra muito emocionante.");
  });

  it("recusa comentário vazio ou com apenas espaços", () => {
    expect(() =>
      Comment.create({ id: 1, musicId: 10, userId: 5, comment: "" }),
    ).toThrow(ValidationError);

    expect(() =>
      Comment.create({ id: 1, musicId: 10, userId: 5, comment: "   " }),
    ).toThrow(ValidationError);
  });

  it("recusa comentário que excede 280 caracteres", () => {
    const longText = "a".repeat(281);
    expect(() =>
      Comment.create({ id: 1, musicId: 10, userId: 5, comment: longText }),
    ).toThrow(ValidationError);

    const valid280 = "a".repeat(280);
    const comment = Comment.create({ id: 1, musicId: 10, userId: 5, comment: valid280 });
    expect(comment.comment.length).toBe(280);
  });

  it("recusa timestamp negativo ou fracionário", () => {
    expect(() =>
      Comment.create({ id: 1, musicId: 10, userId: 5, comment: "Oi", timestamp: -1 }),
    ).toThrow(ValidationError);

    expect(() =>
      Comment.create({ id: 1, musicId: 10, userId: 5, comment: "Oi", timestamp: 12.5 }),
    ).toThrow(ValidationError);
  });

  it("recusa timestamp maior que a duração da música", () => {
    expect(() =>
      Comment.create({
        id: 1,
        musicId: 10,
        userId: 5,
        comment: "Momento final",
        timestamp: 185,
        musicDuration: 180,
      }),
    ).toThrow(ValidationError);
  });

  it("permite marcar como deletado (soft delete)", () => {
    const comment = Comment.create({
      id: 1,
      musicId: 10,
      userId: 5,
      comment: "Vou apagar",
    });

    const deletedTime = new Date("2026-10-20T12:00:00Z");
    comment.markAsDeleted(deletedTime);

    expect(comment.isDeleted).toBe(true);
    expect(comment.deletedAt).toEqual(deletedTime);
  });
});

