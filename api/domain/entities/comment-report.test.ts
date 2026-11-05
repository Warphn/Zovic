import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { CommentReport } from "./comment-report.ts";

describe("CommentReport Entity", () => {
  it("cria denúncia válida para comentário de outro usuário", () => {
    const report = CommentReport.create({
      id: 1,
      commentId: 10,
      userId: 2,
      commentAuthorId: 1,
      reason: "Conteúdo impróprio ou spam.",
    });

    expect(report.id).toBe(1);
    expect(report.commentId).toBe(10);
    expect(report.userId).toBe(2);
    expect(report.reason).toBe("Conteúdo impróprio ou spam.");
  });

  it("impede que o autor denuncie o próprio comentário", () => {
    expect(() =>
      CommentReport.create({
        id: 1,
        commentId: 10,
        userId: 1,
        commentAuthorId: 1,
        reason: "Não gosto mais do que escrevi",
      }),
    ).toThrow(BusinessRuleError);
  });

  it("recusa motivo vazio ou com apenas espaços", () => {
    expect(() =>
      CommentReport.create({
        id: 1,
        commentId: 10,
        userId: 2,
        commentAuthorId: 1,
        reason: "   ",
      }),
    ).toThrow(ValidationError);
  });

  it("recusa motivo que excede 280 caracteres", () => {
    expect(() =>
      CommentReport.create({
        id: 1,
        commentId: 10,
        userId: 2,
        commentAuthorId: 1,
        reason: "x".repeat(281),
      }),
    ).toThrow(ValidationError);
  });
});

