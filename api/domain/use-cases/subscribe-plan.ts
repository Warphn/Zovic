import { BusinessRuleError, ForbiddenError } from "../errors/domain-error.ts";
import type { PlanKind, SubscriptionRepository } from "../ports/subscription-repository.ts";
import { calendarDateIn, isAdult } from "../shared/age.ts";
import { type SubscriptionOutput, toSubscriptionOutput } from "./subscription-output.ts";

/** Mesmo fuso que o projeto usa para decidir a idade (adapters/auth/create-auth.ts). */
const TIME_ZONE = "America/Sao_Paulo";

export interface SubscribePlanInput {
  userId: number;
  kind: PlanKind;
  birthdate: string | null;
  now?: Date;
}

export type SubscribePlanOutput = SubscriptionOutput;

export interface SubscribePlanUseCase {
  execute(input: SubscribePlanInput): Promise<SubscribePlanOutput>;
}

/** Pagamento simulado: a assinatura fica ativa na hora. Só maiores de idade assinam, no individual ou no familiar. */
export class SubscribePlan implements SubscribePlanUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: SubscribePlanInput): Promise<SubscribePlanOutput> {
    const now = input.now ?? new Date();

    // A idade é checada antes de tudo: menor recebe Forbidden mesmo que já tenha assinatura.
    if (!isAdult(input.birthdate, calendarDateIn(now, TIME_ZONE))) {
      throw new ForbiddenError("Only adults can subscribe");
    }

    if ((await this.subscriptions.findActiveByUser(input.userId)) !== null) {
      throw new BusinessRuleError("Account already has an active subscription");
    }

    const subscription = await this.subscriptions.create(input.userId, input.kind, now);
    return toSubscriptionOutput(subscription);
  }
}
