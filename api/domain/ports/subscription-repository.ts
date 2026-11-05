export type PlanKind = "individual" | "family";

export interface ActiveSubscription {
  planId: number;
  kind: PlanKind;
  /** Dono do individual ou gestor do familiar. */
  isManager: boolean;
  startedAt: Date;
}

export interface SubscriptionRepository {
  /** A assinatura ativa da conta (própria ou como membro), ou null. */
  findActiveByUser(userId: number): Promise<ActiveSubscription | null>;
  createIndividual(userId: number, startedAt: Date): Promise<ActiveSubscription>;
  cancel(planId: number, canceledAt: Date): Promise<void>;
}
