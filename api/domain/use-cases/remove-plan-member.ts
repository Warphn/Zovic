import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";

export interface RemovePlanMemberInput {
  userId: number;
  memberId: number;
}

export interface RemovePlanMemberUseCase {
  execute(input: RemovePlanMemberInput): Promise<void>;
}

/** O gestor remove um membro. O acesso cai na próxima requisição, porque o vínculo some. */
export class RemovePlanMember implements RemovePlanMemberUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: RemovePlanMemberInput): Promise<void> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (!subscription.isManager) {
      throw new ForbiddenError("Only the plan manager can remove members");
    }
    if (input.memberId === input.userId) {
      throw new BusinessRuleError("The manager cannot be removed: cancel the plan instead");
    }

    const isRemoved = await this.subscriptions.removeMember(subscription.planId, input.memberId);
    if (!isRemoved) {
      throw new NotFoundError("Member not found");
    }
  }
}
