import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";

export interface CancelSubscriptionInput {
  userId: number;
  now?: Date;
}

export interface CancelSubscriptionUseCase {
  execute(input: CancelSubscriptionInput): Promise<void>;
}

/** Cancelamento imediato. Só o dono do individual ou o gestor do familiar cancela. */
export class CancelSubscription implements CancelSubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: CancelSubscriptionInput): Promise<void> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (!subscription.isManager) {
      throw new ForbiddenError("Only the plan manager can cancel it");
    }

    await this.subscriptions.cancel(subscription.planId, input.now ?? new Date());
  }
}
