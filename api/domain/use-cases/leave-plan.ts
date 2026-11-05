import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";

export interface LeavePlanInput {
  userId: number;
}

export interface LeavePlanUseCase {
  execute(input: LeavePlanInput): Promise<void>;
}

/** O membro sai e perde o acesso na hora. O gestor não sai: ele cancela o plano. */
export class LeavePlan implements LeavePlanUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: LeavePlanInput): Promise<void> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (subscription.isManager) {
      throw new BusinessRuleError("The manager cannot leave the plan: cancel it instead");
    }

    await this.subscriptions.removeMember(subscription.planId, input.userId);
  }
}
