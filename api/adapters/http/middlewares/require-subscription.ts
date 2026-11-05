import type { RequestHandler } from "express";
import type { GetMySubscriptionUseCase } from "../../../domain/use-cases/get-my-subscription.ts";

/**
 * O catálogo é para quem tem assinatura ativa, própria ou como membro de um plano familiar.
 * Admins da plataforma passam sem assinatura, para cuidar do conteúdo. Vai depois do authenticate,
 * que preenche res.locals.
 */
export function makeRequireSubscription(getMySubscription: GetMySubscriptionUseCase): RequestHandler {
  return async (_req, res, next) => {
    if (res.locals.role === "admin") {
      next();
      return;
    }

    const subscription = await getMySubscription.execute({ userId: res.locals.userId });
    if (!subscription) {
      res.status(403).json({ error: "SUBSCRIPTION_REQUIRED", message: "Active subscription required" });
      return;
    }
    next();
  };
}
