import type { RequestHandler } from "express";
import type { AcceptInvitationUseCase } from "../../domain/use-cases/accept-invitation.ts";
import type { CancelPlanInvitationUseCase } from "../../domain/use-cases/cancel-plan-invitation.ts";
import type { CancelSubscriptionUseCase } from "../../domain/use-cases/cancel-subscription.ts";
import type { GetInvitationUseCase } from "../../domain/use-cases/get-invitation.ts";
import type { GetMySubscriptionUseCase } from "../../domain/use-cases/get-my-subscription.ts";
import type { GetPlanMembersUseCase } from "../../domain/use-cases/get-plan-members.ts";
import type { InviteToPlanUseCase } from "../../domain/use-cases/invite-to-plan.ts";
import type { LeavePlanUseCase } from "../../domain/use-cases/leave-plan.ts";
import type { RemovePlanMemberUseCase } from "../../domain/use-cases/remove-plan-member.ts";
import type { SubscribePlanUseCase } from "../../domain/use-cases/subscribe-plan.ts";
import type { PlanKind } from "../../domain/ports/subscription-repository.ts";

export interface SubscriptionUseCases {
  subscribePlan: SubscribePlanUseCase;
  getMySubscription: GetMySubscriptionUseCase;
  cancelSubscription: CancelSubscriptionUseCase;
  getPlanMembers: GetPlanMembersUseCase;
  inviteToPlan: InviteToPlanUseCase;
  cancelPlanInvitation: CancelPlanInvitationUseCase;
  removePlanMember: RemovePlanMemberUseCase;
  leavePlan: LeavePlanUseCase;
  getInvitation: GetInvitationUseCase;
  acceptInvitation: AcceptInvitationUseCase;
}

export interface SubscriptionController {
  subscribe: RequestHandler;
  getMine: RequestHandler;
  cancel: RequestHandler;
  listMembers: RequestHandler;
  invite: RequestHandler;
  cancelInvitation: RequestHandler;
  removeMember: RequestHandler;
  leave: RequestHandler;
  getInvitation: RequestHandler;
  acceptInvitation: RequestHandler;
}

export function makeSubscriptionController(useCases: SubscriptionUseCases): SubscriptionController {
  return {
    subscribe: async (req, res) => {
      // O corpo já passou por validateBody: kind é individual ou family.
      const kind: PlanKind = req.body.kind;
      const subscription = await useCases.subscribePlan.execute({
        kind,
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

    listMembers: async (_req, res) => {
      res.json(await useCases.getPlanMembers.execute({ userId: res.locals.userId }));
    },

    invite: async (req, res) => {
      const invitation = await useCases.inviteToPlan.execute({ userId: res.locals.userId, email: req.body.email });

      res.status(201).json(invitation);
    },

    cancelInvitation: async (req, res) => {
      await useCases.cancelPlanInvitation.execute({
        userId: res.locals.userId,
        invitationId: Number(req.params.id),
      });

      res.sendStatus(204);
    },

    removeMember: async (req, res) => {
      await useCases.removePlanMember.execute({ userId: res.locals.userId, memberId: Number(req.params.userId) });

      res.sendStatus(204);
    },

    leave: async (_req, res) => {
      await useCases.leavePlan.execute({ userId: res.locals.userId });

      res.sendStatus(204);
    },

    getInvitation: async (req, res) => {
      res.json(await useCases.getInvitation.execute({ token: String(req.params.token) }));
    },

    acceptInvitation: async (req, res) => {
      const subscription = await useCases.acceptInvitation.execute({
        token: String(req.params.token),
        userId: res.locals.userId,
        email: res.locals.email,
      });

      res.json(subscription);
    },
  };
}
