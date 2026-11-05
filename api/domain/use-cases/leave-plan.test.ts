import { describe, expect, it } from "bun:test";
import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { LeavePlan } from "./leave-plan.ts";

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new LeavePlan(repository) };
}

describe("LeavePlan", () => {
  it("o membro sai e perde a assinatura; o plano segue com os outros", async () => {
    const { repository, useCase } = setup();
    const planId = repository.seedFamilyPlan(1, [2, 3]);

    await useCase.execute({ userId: 2 });

    expect(await repository.findActiveByUser(2)).toBeNull();
    expect((await repository.findRoster(planId, new Date())).members.map((member) => member.userId)).toEqual([1, 3]);
  });

  it("quem saiu pode entrar em outro plano", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);
    await useCase.execute({ userId: 2 });

    const subscription = await repository.create(2, "individual", new Date());

    expect(subscription.isManager).toBe(true);
  });

  it("o gestor não sai: recebe BusinessRuleError e o plano continua", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);

    const error = await useCase.execute({ userId: 1 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(await repository.findActiveByUser(1)).not.toBeNull();
  });

  it("sem plano, recebe NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 2 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
