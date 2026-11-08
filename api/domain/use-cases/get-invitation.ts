import { NotFoundError } from "../errors/domain-error.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import { hashInvitationToken } from "../shared/plan-invitation.ts";

export interface GetInvitationInput {
  token: string;
  now?: Date;
}

export interface GetInvitationOutput {
  email: string;
  managerName: string;
  /** ISO 8601. */
  expiresAt: string;
}

export interface GetInvitationUseCase {
  execute(input: GetInvitationInput): Promise<GetInvitationOutput>;
}

/** Consulta pública do convite pelo link. Usado, expirado, cancelado ou de plano cancelado é 404. */
export class GetInvitation implements GetInvitationUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: GetInvitationInput): Promise<GetInvitationOutput> {
    const invitation = await this.subscriptions.findPendingInvitationByTokenHash(
      hashInvitationToken(input.token),
      input.now ?? new Date(),
    );
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    return {
      email: invitation.email,
      managerName: invitation.managerName,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }
}
