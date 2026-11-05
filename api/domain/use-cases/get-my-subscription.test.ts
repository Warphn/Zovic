import { describe, expect, it } from "bun:test";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { CancelSubscription } from "./cancel-subscription.ts";
import { GetMySubscription } from "./get-my-subscription.ts";

const STARTED = new Date("2026-10-26T15:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new GetMySubscription(repository) };
}

describe("GetMySubscription", () => {
  it("devolve null para quem não tem assinatura", async () => {
    const { useCase } = setup();

    expect(await useCase.execute({ userId: 7 })).toBeNull();
  });

  it("devolve a assinatura individual com startedAt em ISO", async () => {
    const { repository, useCase } = setup();
    await repository.createIndividual(7, STARTED);

    const output = await useCase.execute({ userId: 7 });

    expect(output).toEqual({ planId: 1, kind: "individual", isManager: true, startedAt: STARTED.toISOString() });
  });

  it("o gestor do familiar vê isManager true", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(7, [8], STARTED);

    expect(await useCase.execute({ userId: 7 })).toEqual({
      planId: 1,
      kind: "family",
      isManager: true,
      startedAt: STARTED.toISOString(),
    });
  });

  it("o membro do familiar vê isManager false", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(7, [8], STARTED);

    expect(await useCase.execute({ userId: 8 })).toMatchObject({ kind: "family", isManager: false });
  });

  it("não mostra a assinatura de outra conta", async () => {
    const { repository, useCase } = setup();
    await repository.createIndividual(1, STARTED);

    expect(await useCase.execute({ userId: 2 })).toBeNull();
  });

  it("depois de cancelar, devolve null", async () => {
    const { repository, useCase } = setup();
    await repository.createIndividual(7, STARTED);
    await new CancelSubscription(repository).execute({ userId: 7 });

    expect(await useCase.execute({ userId: 7 })).toBeNull();
  });
});
