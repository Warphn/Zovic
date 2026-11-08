import { describe, expect, it } from "bun:test";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { CancelSubscription } from "./cancel-subscription.ts";

const STARTED = new Date("2026-10-01T12:00:00.000Z");
const NOW = new Date("2026-10-26T15:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new CancelSubscription(repository) };
}

describe("CancelSubscription", () => {
  it("o dono cancela o individual na hora, gravando o `now`", async () => {
    const { repository, useCase } = setup();
    await repository.create(7, "individual", STARTED);

    await useCase.execute({ userId: 7, now: NOW });

    expect(await repository.findActiveByUser(7)).toBeNull();
    expect(repository.items[0]?.canceledAt).toEqual(NOW);
  });

  it("sem `now`, usa o instante atual", async () => {
    const { repository, useCase } = setup();
    await repository.create(7, "individual", STARTED);
    const before = Date.now();

    await useCase.execute({ userId: 7 });

    const canceledAt = repository.items[0]?.canceledAt?.getTime() ?? 0;
    expect(canceledAt).toBeGreaterThanOrEqual(before);
    expect(canceledAt).toBeLessThanOrEqual(Date.now());
  });

  it("o gestor cancela o familiar e os membros ficam sem assinatura", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2, 3], STARTED);

    await useCase.execute({ userId: 1, now: NOW });

    expect(await repository.findActiveByUser(1)).toBeNull();
    expect(await repository.findActiveByUser(2)).toBeNull();
    expect(await repository.findActiveByUser(3)).toBeNull();
  });

  it("membro do familiar recebe Forbidden e nada é cancelado", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2], STARTED);

    const error = await useCase.execute({ userId: 2, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.items[0]?.canceledAt).toBeNull();
    expect(await repository.findActiveByUser(1)).not.toBeNull();
    expect(await repository.findActiveByUser(2)).not.toBeNull();
  });

  it("quem não tem assinatura recebe NotFoundError", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 7, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("cancelar de novo dá NotFoundError", async () => {
    const { repository, useCase } = setup();
    await repository.create(7, "individual", STARTED);
    await useCase.execute({ userId: 7, now: NOW });

    const error = await useCase.execute({ userId: 7, now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("não mexe na assinatura de outra conta", async () => {
    const { repository, useCase } = setup();
    await repository.create(1, "individual", STARTED);
    await repository.create(2, "individual", STARTED);

    await useCase.execute({ userId: 1, now: NOW });

    expect(await repository.findActiveByUser(1)).toBeNull();
    expect(await repository.findActiveByUser(2)).not.toBeNull();
  });
});
