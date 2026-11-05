import type { ActiveSubscription, PlanKind, SubscriptionRepository } from "../ports/subscription-repository.ts";

interface PlanRow {
  id: number;
  kind: PlanKind;
  startedAt: Date;
  canceledAt: Date | null;
  /** userId -> é gestor? */
  members: Map<number, boolean>;
}

/** Fake do SubscriptionRepository para os testes de use case. */
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly plans = new Map<number, PlanRow>();
  private lastId = 0;

  /** Todos os planos, cancelados inclusive, na ordem de criação. */
  get items(): { planId: number; kind: PlanKind; startedAt: Date; canceledAt: Date | null }[] {
    return [...this.plans.values()].map(({ id, kind, startedAt, canceledAt }) => ({
      planId: id,
      kind,
      startedAt,
      canceledAt,
    }));
  }

  /** Prepara um plano familiar ativo: o gestor e os demais membros. */
  seedFamilyPlan(managerId: number, memberIds: number[], startedAt: Date = new Date()): number {
    this.lastId += 1;
    const members = new Map<number, boolean>([[managerId, true]]);
    for (const memberId of memberIds) {
      members.set(memberId, false);
    }
    this.plans.set(this.lastId, { id: this.lastId, kind: "family", startedAt, canceledAt: null, members });
    return this.lastId;
  }

  async findActiveByUser(userId: number): Promise<ActiveSubscription | null> {
    for (const plan of this.plans.values()) {
      const isManager = plan.members.get(userId);
      if (plan.canceledAt === null && isManager !== undefined) {
        return { planId: plan.id, kind: plan.kind, isManager, startedAt: plan.startedAt };
      }
    }
    return null;
  }

  async createIndividual(userId: number, startedAt: Date): Promise<ActiveSubscription> {
    this.lastId += 1;
    this.plans.set(this.lastId, {
      id: this.lastId,
      kind: "individual",
      startedAt,
      canceledAt: null,
      members: new Map([[userId, true]]),
    });
    return { planId: this.lastId, kind: "individual", isManager: true, startedAt };
  }

  async cancel(planId: number, canceledAt: Date): Promise<void> {
    const plan = this.plans.get(planId);
    if (plan && plan.canceledAt === null) {
      plan.canceledAt = canceledAt;
    }
  }
}
