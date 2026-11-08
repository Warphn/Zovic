import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import {
  generateInvitationToken,
  hasFreeSlot,
  hashInvitationToken,
  invitationExpiresAt,
  normalizeEmail,
} from "../shared/plan-invitation.ts";

export interface InviteToPlanInput {
  userId: number;
  email: string;
  now?: Date;
}

export interface InviteToPlanOutput {
  id: number;
  email: string;
  /** ISO 8601. */
  expiresAt: string;
  /** Token em claro do link. Só esta resposta o devolve: o banco guarda apenas o hash. */
  token: string;
}

export interface InviteToPlanUseCase {
  execute(input: InviteToPlanInput): Promise<InviteToPlanOutput>;
}

/** Só o gestor do plano familiar convida. O convite pendente ocupa uma vaga. */
export class InviteToPlan implements InviteToPlanUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: InviteToPlanInput): Promise<InviteToPlanOutput> {
    const now = input.now ?? new Date();

    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (!subscription.isManager) {
      throw new ForbiddenError("Only the plan manager can invite");
    }
    if (subscription.kind !== "family") {
      throw new BusinessRuleError("Only family plans accept invitations");
    }

    const email = normalizeEmail(input.email);
    const roster = await this.subscriptions.findRoster(subscription.planId, now);
    if (roster.members.some((member) => member.email === email)) {
      throw new BusinessRuleError("This email is already a member of the plan");
    }
    if (roster.pendingInvitations.some((invitation) => invitation.email === email)) {
      throw new BusinessRuleError("This email already has a pending invitation");
    }
    if (!hasFreeSlot(roster.limit, roster.members.length, roster.pendingInvitations.length)) {
      throw new BusinessRuleError("The plan has no free slots");
    }

    const token = generateInvitationToken();
    const invitation = await this.subscriptions.createInvitation({
      planId: subscription.planId,
      email,
      tokenHash: hashInvitationToken(token),
      expiresAt: invitationExpiresAt(now),
      now,
    });

    return { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt.toISOString(), token };
  }
}
