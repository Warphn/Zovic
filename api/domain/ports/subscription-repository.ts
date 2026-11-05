export type PlanKind = "individual" | "family";

export interface ActiveSubscription {
  planId: number;
  kind: PlanKind;
  /** Dono do individual ou gestor do familiar. */
  isManager: boolean;
  startedAt: Date;
}

export interface PlanMember {
  userId: number;
  name: string;
  email: string | null;
  isManager: boolean;
}

export interface PendingInvitation {
  id: number;
  email: string;
  expiresAt: Date;
}

export interface PlanRoster {
  /** Máximo de pessoas do plano, contando o gestor. */
  limit: number;
  members: PlanMember[];
  pendingInvitations: PendingInvitation[];
}

export interface NewInvitation {
  planId: number;
  /** Já em minúsculas. */
  email: string;
  /** SHA-256 em hex do token; o token em claro nunca chega ao repositório. */
  tokenHash: string;
  expiresAt: Date;
  now: Date;
}

/** Um convite pendente (não usado, não cancelado, não expirado) de um plano ativo. */
export interface InvitationDetails {
  id: number;
  planId: number;
  email: string;
  managerName: string;
  expiresAt: Date;
}

export interface AcceptInvitationCommand {
  invitationId: number;
  planId: number;
  userId: number;
  now: Date;
}

export interface SubscriptionRepository {
  /** A assinatura ativa da conta (própria ou como membro), ou null. */
  findActiveByUser(userId: number): Promise<ActiveSubscription | null>;
  /** Cria o plano do tipo pedido, com a conta como dona (individual) ou gestora (familiar). */
  create(userId: number, kind: PlanKind, startedAt: Date): Promise<ActiveSubscription>;
  cancel(planId: number, canceledAt: Date): Promise<void>;

  /** Membros, convites pendentes em `now` e limite do plano. */
  findRoster(planId: number, now: Date): Promise<PlanRoster>;
  /**
   * Grava o convite. Revalida, sob lock do plano, que há vaga e que o email não é de um
   * membro nem de outro convite pendente (BusinessRuleError), para duas chamadas
   * simultâneas não passarem do limite.
   */
  createInvitation(invitation: NewInvitation): Promise<PendingInvitation>;
  /** Cancela um convite pendente do plano. `false` se ele não existe nesse plano ou já não está pendente. */
  cancelInvitation(planId: number, invitationId: number, now: Date): Promise<boolean>;
  findPendingInvitationByTokenHash(tokenHash: string, now: Date): Promise<InvitationDetails | null>;
  /**
   * Marca o convite como usado e põe a conta no plano, numa transação. Revalida sob lock que
   * o convite segue pendente (NotFoundError "Invitation not found") e que a conta segue sem
   * assinatura ativa (BusinessRuleError).
   */
  acceptInvitation(command: AcceptInvitationCommand): Promise<ActiveSubscription>;
  /** Apaga o vínculo de um membro que não é gestor. `false` se ele não é membro desse plano. */
  removeMember(planId: number, userId: number): Promise<boolean>;
}
