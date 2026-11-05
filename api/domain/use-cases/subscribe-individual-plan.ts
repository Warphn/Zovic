import { BusinessRuleError, ForbiddenError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import { calendarDateIn, isAdult } from "../shared/age.ts";
import { type SubscriptionOutput, toSubscriptionOutput } from "./subscription-output.ts";

/** Mesmo fuso que o projeto usa para decidir a idade (adapters/auth/create-auth.ts). */
const TIME_ZONE = "America/Sao_Paulo";

export interface SubscribeIndividualPlanInput {
  userId: number;
  birthdate: string | null;
  now?: Date;
}

export type SubscribeIndividualPlanOutput = SubscriptionOutput;

export interface SubscribeIndividualPlanUseCase {
  execute(input: SubscribeIndividualPlanInput): Promise<SubscribeIndividualPlanOutput>;
}

/** Pagamento simulado: a assinatura fica ativa na hora. Só maiores de idade assinam. */
export class SubscribeIndividualPlan implements SubscribeIndividualPlanUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: SubscribeIndividualPlanInput): Promise<SubscribeIndividualPlanOutput> {
    const now = input.now ?? new Date();

    // A idade é checada antes de tudo: menor recebe Forbidden mesmo que já tenha assinatura.
    if (!isAdult(input.birthdate, calendarDateIn(now, TIME_ZONE))) {
      throw new ForbiddenError("Only adults can subscribe");
    }

    if ((await this.subscriptions.findActiveByUser(input.userId)) !== null) {
      throw new BusinessRuleError("Account already has an active subscription");
    }

    const subscription = await this.subscriptions.createIndividual(input.userId, now);
    return toSubscriptionOutput(subscription);
  }
}
