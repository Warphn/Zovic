import { describe, expect, it } from "bun:test";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { CancelPlanInvitation } from "./cancel-plan-invitation.ts";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const IN_A_WEEK = new Date("2026-11-12T12:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new CancelPlanInvitation(repository) };
}

describe("CancelPlanInvitation", () => {
  it("cancela o convite pendente: o link deixa de valer e a vaga volta", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, []);
    const invitationId = repository.seedInvitation(planId, "ana@example.com", "hash", IN_A_WEEK);

    await useCase.execute({ userId: 1, invitationId, now: NOW });

    expect(await repository.findPendingInvitationByTokenHash("hash", NOW)).toBeNull();
    expect((await repository.findRoster(planId, NOW)).pendingInvitations).toEqual([]);
  });

  it("convite de outro plano é NotFound e continua pendente", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);
    const otherPlanId = repository.seedFamilyPlan(9, []);
    const invitationId = repository.seedInvitation(otherPlanId, "ana@example.com", "hash", IN_A_WEEK);

    const error = await useCase.execute({ userId: 1, invitationId, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(await repository.findPendingInvitationByTokenHash("hash", NOW)).not.toBeNull();
  });

  it("convite já cancelado é NotFound", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, []);
    const invitationId = repository.seedInvitation(planId, "ana@example.com", "hash", IN_A_WEEK);
    await useCase.execute({ userId: 1, invitationId, now: NOW });

    const error = await useCase.execute({ userId: 1, invitationId, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("convite expirado é NotFound", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, []);
    const invitationId = repository.seedInvitation(planId, "ana@example.com", "hash", IN_A_WEEK);

    const error = await useCase
      .execute({ userId: 1, invitationId, now: new Date("2026-11-13T00:00:00.000Z") })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("membro que não é gestor recebe Forbidden e o convite segue pendente", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, [2]);
    const invitationId = repository.seedInvitation(planId, "ana@example.com", "hash", IN_A_WEEK);

    const error = await useCase.execute({ userId: 2, invitationId, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(await repository.findPendingInvitationByTokenHash("hash", NOW)).not.toBeNull();
  });

  it("sem assinatura ativa, recebe NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 1, invitationId: 1, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
