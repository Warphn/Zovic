import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import type {
  AcceptInvitationCommand,
  ActiveSubscription,
  InvitationDetails,
  NewInvitation,
  PendingInvitation,
  PlanKind,
  PlanRoster,
  SubscriptionRepository,
} from "../ports/subscription-repository.ts";

const LIMIT_BY_KIND: Record<PlanKind, number> = { individual: 1, family: 4 };

interface PlanRow {
  id: number;
  kind: PlanKind;
  startedAt: Date;
  canceledAt: Date | null;
  /** userId -> é gestor? */
  members: Map<number, boolean>;
}

interface InvitationRow {
  id: number;
  planId: number;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  canceledAt: Date | null;
}

interface UserRow {
  name: string;
  email: string | null;
}

/** Fake do SubscriptionRepository para os testes de use case. */
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly plans = new Map<number, PlanRow>();
  private readonly invitationRows: InvitationRow[] = [];
  private readonly users = new Map<number, UserRow>();
  private lastId = 0;
  private lastInvitationId = 0;

  /** Todos os planos, cancelados inclusive, na ordem de criação. */
  get items(): { planId: number; kind: PlanKind; startedAt: Date; canceledAt: Date | null }[] {
    return [...this.plans.values()].map(({ id, kind, startedAt, canceledAt }) => ({
      planId: id,
      kind,
      startedAt,
      canceledAt,
    }));
  }

  /** Todos os convites, em qualquer estado, na ordem de criação. */
  get invitations(): readonly InvitationRow[] {
    return this.invitationRows;
  }

  /** Nome e email de uma conta, para os testes que olham a lista de membros. */
  seedUser(userId: number, name: string, email: string | null): void {
    this.users.set(userId, { name, email });
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

  /** Prepara um convite pendente, sem passar pelo caso de uso. */
  seedInvitation(planId: number, email: string, tokenHash: string, expiresAt: Date): number {
    this.lastInvitationId += 1;
    this.invitationRows.push({
      id: this.lastInvitationId,
      planId,
      email,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      canceledAt: null,
    });
    return this.lastInvitationId;
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

  async create(userId: number, kind: PlanKind, startedAt: Date): Promise<ActiveSubscription> {
    this.lastId += 1;
    this.plans.set(this.lastId, {
      id: this.lastId,
      kind,
      startedAt,
      canceledAt: null,
      members: new Map([[userId, true]]),
    });
    return { planId: this.lastId, kind, isManager: true, startedAt };
  }

  async cancel(planId: number, canceledAt: Date): Promise<void> {
    const plan = this.plans.get(planId);
    if (plan && plan.canceledAt === null) {
      plan.canceledAt = canceledAt;
    }
  }

  async findRoster(planId: number, now: Date): Promise<PlanRoster> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }
    const members = [...plan.members].map(([userId, isManager]) => {
      const user = this.users.get(userId);
      return { userId, name: user?.name ?? `User ${userId}`, email: user ? user.email : null, isManager };
    });
    return { limit: LIMIT_BY_KIND[plan.kind], members, pendingInvitations: this.pendingOf(planId, now) };
  }

  async createInvitation(invitation: NewInvitation): Promise<PendingInvitation> {
    const roster = await this.findRoster(invitation.planId, invitation.now);
    const isTaken =
      roster.members.some((member) => member.email === invitation.email) ||
      roster.pendingInvitations.some((pending) => pending.email === invitation.email);
    if (isTaken || roster.members.length + roster.pendingInvitations.length >= roster.limit) {
      throw new BusinessRuleError("Invitation is no longer possible");
    }
    const id = this.seedInvitation(invitation.planId, invitation.email, invitation.tokenHash, invitation.expiresAt);
    return { id, email: invitation.email, expiresAt: invitation.expiresAt };
  }

  async cancelInvitation(planId: number, invitationId: number, now: Date): Promise<boolean> {
    const invitation = this.invitationRows.find((row) => row.id === invitationId && row.planId === planId);
    if (!invitation || !this.isPending(invitation, now)) {
      return false;
    }
    invitation.canceledAt = now;
    return true;
  }

  async findPendingInvitationByTokenHash(tokenHash: string, now: Date): Promise<InvitationDetails | null> {
    const invitation = this.invitationRows.find((row) => row.tokenHash === tokenHash);
    if (!invitation || !this.isPending(invitation, now)) {
      return null;
    }
    const plan = this.plans.get(invitation.planId);
    const managerId = [...(plan?.members ?? [])].find(([, isManager]) => isManager)?.[0];
    const managerName = managerId === undefined ? "" : (this.users.get(managerId)?.name ?? `User ${managerId}`);
    return {
      id: invitation.id,
      planId: invitation.planId,
      email: invitation.email,
      managerName,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(command: AcceptInvitationCommand): Promise<ActiveSubscription> {
    const invitation = this.invitationRows.find((row) => row.id === command.invitationId);
    const plan = this.plans.get(command.planId);
    if (!invitation || !plan || !this.isPending(invitation, command.now)) {
      throw new NotFoundError("Invitation not found");
    }
    if ((await this.findActiveByUser(command.userId)) !== null) {
      throw new BusinessRuleError("Account already has an active subscription");
    }
    invitation.acceptedAt = command.now;
    plan.members.set(command.userId, false);
    return { planId: plan.id, kind: plan.kind, isManager: false, startedAt: plan.startedAt };
  }

  async removeMember(planId: number, userId: number): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan || plan.members.get(userId) !== false) {
      return false;
    }
    return plan.members.delete(userId);
  }

  private pendingOf(planId: number, now: Date): PendingInvitation[] {
    return this.invitationRows
      .filter((row) => row.planId === planId && this.isPending(row, now))
      .map(({ id, email, expiresAt }) => ({ id, email, expiresAt }));
  }

  private isPending(invitation: InvitationRow, now: Date): boolean {
    const plan = this.plans.get(invitation.planId);
    return (
      plan?.canceledAt === null &&
      invitation.acceptedAt === null &&
      invitation.canceledAt === null &&
      invitation.expiresAt > now
    );
  }
}
