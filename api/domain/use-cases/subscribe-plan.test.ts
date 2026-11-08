import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ForbiddenError } from "../errors/domain-error.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { CancelSubscription } from "./cancel-subscription.ts";
import { SubscribePlan } from "./subscribe-plan.ts";

const NOW = new Date("2026-10-26T15:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  return { repository, useCase: new SubscribePlan(repository) };
}

describe("SubscribePlan (individual)", () => {
  it("ativa a assinatura individual na hora, com a pessoa como dona", async () => {
    const { repository, useCase } = setup();

    const output = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });

    expect(output).toEqual({ planId: 1, kind: "individual", isManager: true, startedAt: NOW.toISOString() });
    expect(await repository.findActiveByUser(7)).toMatchObject({ kind: "individual", isManager: true });
    expect(repository.items).toHaveLength(1);
  });

  it("devolve startedAt como string ISO e grava o `now` recebido", async () => {
    const { repository, useCase } = setup();

    const output = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });

    expect(new Date(output.startedAt).toISOString()).toBe(output.startedAt);
    expect(repository.items[0]?.startedAt).toEqual(NOW);
  });

  it("sem `now`, usa o instante atual", async () => {
    const { repository, useCase } = setup();
    const before = Date.now();

    await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10" });

    const startedAt = repository.items[0]?.startedAt.getTime() ?? 0;
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(Date.now());
  });

  it("aceita quem completa 18 anos hoje", async () => {
    const { useCase } = setup();

    const output = await useCase.execute({ userId: 7, kind: "individual", birthdate: "2008-10-26", now: NOW });

    expect(output.kind).toBe("individual");
  });

  it("recusa quem completa 18 anos amanhã e não cria nada", async () => {
    const { repository, useCase } = setup();

    const error = await useCase.execute({ userId: 7, kind: "individual", birthdate: "2008-10-27", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.items).toHaveLength(0);
  });

  it("decide a idade no fuso de São Paulo, não em UTC", async () => {
    const { repository, useCase } = setup();
    // 01:00 UTC de 27/10 ainda é 26/10 em São Paulo: quem nasceu em 27/10/2008 ainda é menor.
    const lateNight = new Date("2026-10-27T01:00:00.000Z");

    const error = await useCase
      .execute({ userId: 7, kind: "individual", birthdate: "2008-10-27", now: lateNight })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.items).toHaveLength(0);
  });

  it.each([{ birthdate: null }, { birthdate: "" }, { birthdate: "2015-03-02" }])(
    "trata %p como menor: Forbidden e nada é criado",
    async ({ birthdate }) => {
      const { repository, useCase } = setup();

      const error = await useCase.execute({ userId: 7, kind: "individual", birthdate, now: NOW }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(repository.items).toHaveLength(0);
    },
  );

  it("menor recebe Forbidden mesmo que já tenha assinatura", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [7]);

    const error = await useCase.execute({ userId: 7, kind: "individual", birthdate: "2015-03-02", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.items).toHaveLength(1);
  });

  it("assinar de novo dá BusinessRuleError e não cria outra", async () => {
    const { repository, useCase } = setup();
    await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });

    const error = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(repository.items).toHaveLength(1);
  });

  it("quem é membro de plano familiar não assina o individual", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [7]);

    const error = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(repository.items).toHaveLength(1);
  });

  it("quem é gestor de plano familiar não assina o individual", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(7, [1]);

    const error = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("assinaturas de outras contas não atrapalham", async () => {
    const { repository, useCase } = setup();
    await useCase.execute({ userId: 1, kind: "individual", birthdate: "1990-05-10", now: NOW });

    const output = await useCase.execute({ userId: 2, kind: "individual", birthdate: "1990-05-10", now: NOW });

    expect(output.planId).toBe(2);
    expect(repository.items).toHaveLength(2);
  });

  it("depois de cancelar, a pessoa pode assinar de novo", async () => {
    const { repository, useCase } = setup();
    await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });
    await new CancelSubscription(repository).execute({ userId: 7, now: NOW });

    const output = await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });

    expect(output).toMatchObject({ planId: 2, kind: "individual", isManager: true });
    expect(await repository.findActiveByUser(7)).toMatchObject({ planId: 2 });
  });
});

describe("SubscribePlan (familiar)", () => {
  it("ativa o plano familiar com a pessoa como gestora", async () => {
    const { repository, useCase } = setup();

    const output = await useCase.execute({ userId: 7, kind: "family", birthdate: "1990-05-10", now: NOW });

    expect(output).toEqual({ planId: 1, kind: "family", isManager: true, startedAt: NOW.toISOString() });
    expect(await repository.findActiveByUser(7)).toMatchObject({ kind: "family", isManager: true });
  });

  it("recusa menor de idade com Forbidden e não cria nada", async () => {
    const { repository, useCase } = setup();

    const error = await useCase
      .execute({ userId: 7, kind: "family", birthdate: "2015-03-02", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.items).toHaveLength(0);
  });

  it("recusa quem já tem assinatura ativa", async () => {
    const { repository, useCase } = setup();
    await useCase.execute({ userId: 7, kind: "individual", birthdate: "1990-05-10", now: NOW });

    const error = await useCase
      .execute({ userId: 7, kind: "family", birthdate: "1990-05-10", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(repository.items).toHaveLength(1);
  });
});
