import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";

export interface CancelPlanInvitationInput {
  userId: number;
  invitationId: number;
  now?: Date;
}

export interface CancelPlanInvitationUseCase {
  execute(input: CancelPlanInvitationInput): Promise<void>;
}

/** O link deixa de valer e a vaga volta. Convite de outro plano ou já não pendente é 404. */
export class CancelPlanInvitation implements CancelPlanInvitationUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: CancelPlanInvitationInput): Promise<void> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (!subscription.isManager) {
      throw new ForbiddenError("Only the plan manager can cancel invitations");
    }

    const isCanceled = await this.subscriptions.cancelInvitation(
      subscription.planId,
      input.invitationId,
      input.now ?? new Date(),
    );
    if (!isCanceled) {
      throw new NotFoundError("Invitation not found");
    }
  }
}
