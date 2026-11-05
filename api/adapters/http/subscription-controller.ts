import type { RequestHandler } from "express";
import type { CancelSubscriptionUseCase } from "../../domain/use-cases/cancel-subscription.ts";
import type { GetMySubscriptionUseCase } from "../../domain/use-cases/get-my-subscription.ts";
import type { SubscribeIndividualPlanUseCase } from "../../domain/use-cases/subscribe-individual-plan.ts";

export interface SubscriptionUseCases {
  subscribeIndividualPlan: SubscribeIndividualPlanUseCase;
  getMySubscription: GetMySubscriptionUseCase;
  cancelSubscription: CancelSubscriptionUseCase;
}

export interface SubscriptionController {
  subscribe: RequestHandler;
  getMine: RequestHandler;
  cancel: RequestHandler;
}

export function makeSubscriptionController(useCases: SubscriptionUseCases): SubscriptionController {
  return {
    subscribe: async (_req, res) => {
      const subscription = await useCases.subscribeIndividualPlan.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
      });

      res.status(201).json(subscription);
    },

    getMine: async (_req, res) => {
      const subscription = await useCases.getMySubscription.execute({ userId: res.locals.userId });

      res.json(subscription);
    },

    cancel: async (_req, res) => {
      await useCases.cancelSubscription.execute({ userId: res.locals.userId });

      res.sendStatus(204);
    },
  };
}
