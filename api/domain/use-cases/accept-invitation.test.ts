import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { hashInvitationToken } from "../shared/plan-invitation.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { AcceptInvitation } from "./accept-invitation.ts";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const IN_A_WEEK = new Date("2026-11-12T12:00:00.000Z");
const TOKEN = "token-em-claro";
const PLAN_STARTED_AT = new Date("2026-11-01T12:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  const planId = repository.seedFamilyPlan(1, [], PLAN_STARTED_AT);
  repository.seedInvitation(planId, "ana@example.com", hashInvitationToken(TOKEN), IN_A_WEEK);
  return { repository, planId, useCase: new AcceptInvitation(repository) };
}

describe("AcceptInvitation", () => {
  it("a conta com o email do convite vira membro do plano", async () => {
    const { repository, planId, useCase } = setup();

    const output = await useCase.execute({ token: TOKEN, userId: 5, email: "ana@example.com", now: NOW });

    expect(output).toEqual({
      planId,
      kind: "family",
      isManager: false,
      startedAt: PLAN_STARTED_AT.toISOString(),
    });
    expect(await repository.findActiveByUser(5)).toMatchObject({ planId, isManager: false });
  });

  it("compara o email sem diferenciar maiúsculas", async () => {
    const { useCase } = setup();

    const output = await useCase.execute({ token: TOKEN, userId: 5, email: "ANA@Example.com", now: NOW });

    expect(output.isManager).toBe(false);
  });

  it("o convite só vale uma vez: o segundo aceite é NotFound", async () => {
    const { useCase } = setup();
    await useCase.execute({ token: TOKEN, userId: 5, email: "ana@example.com", now: NOW });

    const error = await useCase
      .execute({ token: TOKEN, userId: 6, email: "ana@example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toHaveProperty("message", "Invitation not found");
  });

  it("outra conta com o mesmo token, sem email igual, recebe Forbidden e o convite segue pendente", async () => {
    const { repository, useCase } = setup();

    const error = await useCase
      .execute({ token: TOKEN, userId: 5, email: "outra@example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(await repository.findActiveByUser(5)).toBeNull();
    expect(await repository.findPendingInvitationByTokenHash(hashInvitationToken(TOKEN), NOW)).not.toBeNull();
  });

  it("quem já tem assinatura ativa recebe BusinessRuleError e o convite segue pendente", async () => {
    const { repository, useCase } = setup();
    await repository.create(5, "individual", NOW);

    const error = await useCase
      .execute({ token: TOKEN, userId: 5, email: "ana@example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(await repository.findPendingInvitationByTokenHash(hashInvitationToken(TOKEN), NOW)).not.toBeNull();
  });

  it("convite expirado é NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ token: TOKEN, userId: 5, email: "ana@example.com", now: new Date("2026-11-12T12:00:00.000Z") })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("convite de plano cancelado é NotFound", async () => {
    const { repository, planId, useCase } = setup();
    await repository.cancel(planId, NOW);

    const error = await useCase
      .execute({ token: TOKEN, userId: 5, email: "ana@example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("token desconhecido é NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ token: "outro", userId: 5, email: "ana@example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
