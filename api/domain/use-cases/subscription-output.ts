import type { ActiveSubscription, PlanKind } from "../ports/subscription-repository.ts";

export interface SubscriptionOutput {
  planId: number;
  kind: PlanKind;
  isManager: boolean;
  /** ISO 8601. */
  startedAt: string;
}

export function toSubscriptionOutput(subscription: ActiveSubscription): SubscriptionOutput {
  return {
    planId: subscription.planId,
    kind: subscription.kind,
    isManager: subscription.isManager,
    startedAt: subscription.startedAt.toISOString(),
  };
}
