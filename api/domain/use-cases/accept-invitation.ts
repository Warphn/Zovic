import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import { hashInvitationToken, normalizeEmail } from "../shared/plan-invitation.ts";
import { type SubscriptionOutput, toSubscriptionOutput } from "./subscription-output.ts";

export interface AcceptInvitationInput {
  token: string;
  userId: number;
  /** Email da conta que aceita. */
  email: string;
  now?: Date;
}

export type AcceptInvitationOutput = SubscriptionOutput;

export interface AcceptInvitationUseCase {
  execute(input: AcceptInvitationInput): Promise<AcceptInvitationOutput>;
}

/** Só a conta com o email do convite aceita, e só quem não tem assinatura ativa. Menor também aceita. */
export class AcceptInvitation implements AcceptInvitationUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: AcceptInvitationInput): Promise<AcceptInvitationOutput> {
    const now = input.now ?? new Date();

    const invitation = await this.subscriptions.findPendingInvitationByTokenHash(
      hashInvitationToken(input.token),
      now,
    );
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }
    if (normalizeEmail(input.email) !== invitation.email) {
      throw new ForbiddenError("This invitation was sent to another email");
    }
    if ((await this.subscriptions.findActiveByUser(input.userId)) !== null) {
      throw new BusinessRuleError("Leave or cancel your current plan before accepting an invitation");
    }

    // O repositório revalida sob lock: dois aceites simultâneos do mesmo convite não passam os dois.
    const subscription = await this.subscriptions.acceptInvitation({
      invitationId: invitation.id,
      planId: invitation.planId,
      userId: input.userId,
      now,
    });
    return toSubscriptionOutput(subscription);
  }
}
