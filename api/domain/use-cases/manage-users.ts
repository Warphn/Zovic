import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import type { AdminUserItem, NewAccountInput, UserAccounts } from "../ports/admin-queries.ts";

/** Gestão de contas pelo painel de admin. */
export class ManageUsers {
  constructor(private readonly accounts: UserAccounts) {}

  create(input: NewAccountInput): Promise<AdminUserItem> {
    return this.accounts.create({ ...input, name: input.name.trim(), email: input.email.trim().toLowerCase() });
  }

  async remove(actorId: number, userId: number): Promise<void> {
    if (actorId === userId) {
      throw new BusinessRuleError("Admins cannot remove their own account");
    }
    const user = await this.accounts.find(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }
    // A plataforma nunca fica sem admin ativo.
    if (user.role === "admin" && (await this.accounts.countActiveAdmins()) <= 1) {
      throw new BusinessRuleError("The last platform admin cannot be removed");
    }
    await this.accounts.remove(userId);
  }
}
