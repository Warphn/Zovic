import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";

export interface GetPlanMembersInput {
  userId: number;
  now?: Date;
}

export interface GetPlanMembersOutput {
  members: { id: number; name: string; email: string | null; isManager: boolean }[];
  pendingInvitations: { id: number; email: string; /** ISO 8601. */ expiresAt: string }[];
  limit: number;
  freeSlots: number;
}

export interface GetPlanMembersUseCase {
  execute(input: GetPlanMembersInput): Promise<GetPlanMembersOutput>;
}

/** O gestor vê quem está no plano, os convites pendentes e quantas vagas sobram. */
export class GetPlanMembers implements GetPlanMembersUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: GetPlanMembersInput): Promise<GetPlanMembersOutput> {
    const subscription = await this.subscriptions.findActiveByUser(input.userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription");
    }
    if (!subscription.isManager) {
      throw new ForbiddenError("Only the plan manager can list members");
    }

    const roster = await this.subscriptions.findRoster(subscription.planId, input.now ?? new Date());
    const occupiedSlots = roster.members.length + roster.pendingInvitations.length;

    return {
      members: roster.members.map((member) => ({
        id: member.userId,
        name: member.name,
        email: member.email,
        isManager: member.isManager,
      })),
      pendingInvitations: roster.pendingInvitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
      limit: roster.limit,
      freeSlots: Math.max(0, roster.limit - occupiedSlots),
    };
  }
}
