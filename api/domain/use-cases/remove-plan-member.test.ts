import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { RemovePlanMember } from "./remove-plan-member.ts";

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new RemovePlanMember(repository) };
}

describe("RemovePlanMember", () => {
  it("o gestor remove o membro, que perde a assinatura", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2, 3]);

    await useCase.execute({ userId: 1, memberId: 2 });

    expect(await repository.findActiveByUser(2)).toBeNull();
    expect(await repository.findActiveByUser(3)).not.toBeNull();
    expect(await repository.findActiveByUser(1)).not.toBeNull();
  });

  it("a vaga volta para o plano", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, [2, 3, 4]);

    await useCase.execute({ userId: 1, memberId: 2 });

    expect((await repository.findRoster(planId, new Date())).members).toHaveLength(3);
  });

  it("membro que não é gestor recebe Forbidden e ninguém é removido", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2, 3]);

    const error = await useCase.execute({ userId: 2, memberId: 3 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(await repository.findActiveByUser(3)).not.toBeNull();
  });

  it("alvo que não é membro do plano é NotFound", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);
    repository.seedFamilyPlan(8, [9]);

    const error = await useCase.execute({ userId: 1, memberId: 9 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(await repository.findActiveByUser(9)).not.toBeNull();
  });

  it("o gestor não remove a si mesmo: recebe BusinessRuleError", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);

    const error = await useCase.execute({ userId: 1, memberId: 1 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(await repository.findActiveByUser(1)).not.toBeNull();
  });

  it("sem assinatura ativa, recebe NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 1, memberId: 2 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
