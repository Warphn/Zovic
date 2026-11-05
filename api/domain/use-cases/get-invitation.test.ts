import { describe, expect, it } from "bun:test";
import { NotFoundError } from "../errors/domain-error.ts";
import { hashInvitationToken } from "../shared/plan-invitation.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { GetInvitation } from "./get-invitation.ts";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const IN_A_WEEK = new Date("2026-11-12T12:00:00.000Z");
const TOKEN = "token-em-claro";

function setup() {
  const repository = new InMemorySubscriptionRepository();
  repository.seedUser(1, "Gestora", "gestora@example.com");
  const planId = repository.seedFamilyPlan(1, []);
  repository.seedInvitation(planId, "ana@example.com", hashInvitationToken(TOKEN), IN_A_WEEK);
  return { repository, planId, useCase: new GetInvitation(repository) };
}

describe("GetInvitation", () => {
  it("devolve email, nome do gestor e validade a partir do token em claro", async () => {
    const { useCase } = setup();

    const output = await useCase.execute({ token: TOKEN, now: NOW });

    expect(output).toEqual({
      email: "ana@example.com",
      managerName: "Gestora",
      expiresAt: IN_A_WEEK.toISOString(),
    });
  });

  it("token desconhecido é NotFound com a mensagem 'Invitation not found'", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ token: "outro", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toHaveProperty("message", "Invitation not found");
  });

  it("convite expirado é NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase
      .execute({ token: TOKEN, now: new Date("2026-11-12T12:00:00.000Z") })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("convite de plano cancelado é NotFound", async () => {
    const { repository, planId, useCase } = setup();
    await repository.cancel(planId, NOW);

    const error = await useCase.execute({ token: TOKEN, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("convite cancelado é NotFound", async () => {
    const { repository, planId, useCase } = setup();
    const [invitation] = (await repository.findRoster(planId, NOW)).pendingInvitations;
    await repository.cancelInvitation(planId, invitation?.id ?? 0, NOW);

    const error = await useCase.execute({ token: TOKEN, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
