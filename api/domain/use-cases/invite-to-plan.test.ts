import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { hashInvitationToken } from "../shared/plan-invitation.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { InviteToPlan } from "./invite-to-plan.ts";

const NOW = new Date("2026-11-05T12:00:00.000Z");

function setup() {
  const repository = new InMemorySubscriptionRepository();
  repository.seedUser(1, "Gestora", "gestora@example.com");
  repository.seedUser(2, "Membro", "membro@example.com");
  return { repository, useCase: new InviteToPlan(repository) };
}

describe("InviteToPlan", () => {
  it("cria um convite pendente válido por 7 dias e devolve o token em claro", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const output = await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW });

    expect(output).toMatchObject({ email: "ana@example.com", expiresAt: "2026-11-12T12:00:00.000Z" });
    expect(output.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.invitations).toHaveLength(1);
  });

  it("guarda só o hash do token", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const output = await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW });

    expect(repository.invitations[0]?.tokenHash).toBe(hashInvitationToken(output.token));
    expect(JSON.stringify(repository.invitations)).not.toContain(output.token);
  });

  it("gera um token diferente a cada convite", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const first = await useCase.execute({ userId: 1, email: "a@example.com", now: NOW });
    const second = await useCase.execute({ userId: 1, email: "b@example.com", now: NOW });

    expect(first.token).not.toBe(second.token);
  });

  it("grava o email em minúsculas e sem espaços", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const output = await useCase.execute({ userId: 1, email: "  Ana@Example.COM ", now: NOW });

    expect(output.email).toBe("ana@example.com");
    expect(repository.invitations[0]?.email).toBe("ana@example.com");
  });

  it("aceita o convite que ocupa a última vaga e recusa o seguinte", async () => {
    const { repository, useCase } = setup();
    // gestor + 1 membro + 1 convite pendente: sobra uma vaga das 4
    repository.seedFamilyPlan(1, [2]);
    await useCase.execute({ userId: 1, email: "a@example.com", now: NOW });

    await useCase.execute({ userId: 1, email: "b@example.com", now: NOW });
    const error = await useCase.execute({ userId: 1, email: "c@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(repository.invitations).toHaveLength(2);
  });

  it("convite expirado libera a vaga", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);
    await useCase.execute({ userId: 1, email: "a@example.com", now: NOW });
    await useCase.execute({ userId: 1, email: "b@example.com", now: NOW });
    const afterExpiry = new Date("2026-11-12T12:00:00.001Z");

    const output = await useCase.execute({ userId: 1, email: "c@example.com", now: afterExpiry });

    expect(output.email).toBe("c@example.com");
  });

  it("recusa email que já tem convite pendente, mesmo com outra caixa", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);
    await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW });

    const error = await useCase.execute({ userId: 1, email: "ANA@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(repository.invitations).toHaveLength(1);
  });

  it("permite convidar de novo o email cujo convite expirou", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);
    await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW });

    const output = await useCase.execute({
      userId: 1,
      email: "ana@example.com",
      now: new Date("2026-11-13T00:00:00.000Z"),
    });

    expect(output.email).toBe("ana@example.com");
  });

  it("recusa o email de quem já é membro do plano", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);

    const error = await useCase
      .execute({ userId: 1, email: "Membro@Example.com", now: NOW })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("recusa o email do próprio gestor", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);

    const error = await useCase.execute({ userId: 1, email: "gestora@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("membro que não é gestor recebe Forbidden", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, [2]);

    const error = await useCase.execute({ userId: 2, email: "ana@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.invitations).toHaveLength(0);
  });

  it("dono de plano individual recebe BusinessRuleError", async () => {
    const { repository, useCase } = setup();
    await repository.create(1, "individual", NOW);

    const error = await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("sem assinatura ativa, recebe NotFound", async () => {
    const { useCase } = setup();

    const error = await useCase.execute({ userId: 1, email: "ana@example.com", now: NOW }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("sem `now`, usa o instante atual", async () => {
    const { repository, useCase } = setup();
    repository.seedFamilyPlan(1, []);
    const before = Date.now();

    const output = await useCase.execute({ userId: 1, email: "ana@example.com" });

    const expiresAt = new Date(output.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
  });
});
