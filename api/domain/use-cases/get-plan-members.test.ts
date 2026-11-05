import { describe, expect, it } from "bun:test";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { GetPlanMembers } from "./get-plan-members.ts";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const IN_A_WEEK = new Date("2026-11-12T12:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  repository.seedUser(1, "Gestora", "gestora@example.com");
  repository.seedUser(2, "Membro", "membro@example.com");
  return { repository, useCase: new GetPlanMembers(repository) };
}

describe("GetPlanMembers", () => {
  it("devolve membros, convites pendentes, limite e vagas livres", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, [2]);
    const invitationId = repository.seedInvitation(planId, "ana@example.com", "hash", IN_A_WEEK);

    const output = await useCase.execute({ userId: 1, now: NOW });

    expect(output).toEqual({
      members: [
        { id: 1, name: "Gestora", email: "gestora@example.com", isManager: true },
        { id: 2, name: "Membro", email: "membro@example.com", isManager: false },
      ],
      pendingInvitations: [{ id: invitationId, email: "ana@example.com", expiresAt: IN_A_WEEK.toISOString() }],
      limit: 4,
      freeSlots: 1,
    });
  });

  it("plano recém-assinado tem 1 de 4 vagas ocupadas", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const output = await useCase.execute({ userId: 1, now: NOW });

    expect(output.limit).toBe(4);
    expect(output.freeSlots).toBe(3);
  });

  it("não lista convite expirado nem conta a vaga dele", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, []);
    repository.seedInvitation(planId, "ana@example.com", "hash", new Date("2026-11-05T11:59:59.000Z"));

    const output = await useCase.execute({ userId: 1, now: NOW });

    expect(output.pendingInvitations).toEqual([]);
    expect(output.freeSlots).toBe(3);
  });

  it("membro que não é gestor recebe Forbidden", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);

    const error = await useCase.execute({ userId: 2, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("sem assinatura ativa, recebe NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 1, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
