import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import { type SubscriptionOutput, toSubscriptionOutput } from "./subscription-output.ts";

export interface GetMySubscriptionInput {
  userId: number;
}

export type GetMySubscriptionOutput = SubscriptionOutput | null;

export interface GetMySubscriptionUseCase {
  execute(input: GetMySubscriptionInput): Promise<GetMySubscriptionOutput>;
}

/** Sem assinatura ativa, devolve null (não é erro). */
export class GetMySubscription implements GetMySubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: GetMySubscriptionInput): Promise<GetMySubscriptionOutput> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    return subscription ? toSubscriptionOutput(subscription) : null;
  }
}
