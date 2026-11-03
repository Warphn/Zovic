import type { Pool } from "pg";
import { BusinessRuleError } from "../../domain/errors/domain-error.ts";
import type { AdminUserItem, NewAccountInput, UserAccounts } from "../../domain/ports/admin-queries.ts";
import type { Auth } from "./create-auth.ts";

/**
 * Contas criadas e removidas pelo admin. A criação passa pelo adapter interno do Better Auth,
 * com o hash de senha dele e a conta 'credential' do jeito que o login espera, mas sem abrir
 * sessão: quem entra depois é o próprio usuário, com a senha que o admin definiu.
 */
export class BetterAuthUserAccounts implements UserAccounts {
  constructor(
    private readonly auth: Auth,
    private readonly pool: Pool,
  ) {}

  async create(input: NewAccountInput): Promise<AdminUserItem> {
    const ctx = await this.auth.$context;
    if (await ctx.internalAdapter.findUserByEmail(input.email)) {
      throw new BusinessRuleError("Email already in use");
    }

    // Os databaseHooks de user.create (nome e tamanho do email) também valem aqui.
    const user = await ctx.internalAdapter.createUser(
      { name: input.name, email: input.email, emailVerified: false, birthdate: input.birthdate, role: input.role },
      { method: "email-password" },
    );
    try {
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await ctx.password.hash(input.password),
      });
    } catch (error) {
      // Sem conta de credencial o usuário não conseguiria entrar: desfaz o cadastro.
      await this.pool.query(`DELETE FROM "user" WHERE id = $1`, [Number(user.id)]);
      throw error;
    }

    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: input.role,
      birthdate: input.birthdate,
      createdAt: new Date(user.createdAt).toISOString(),
      deletedAt: null,
      plays: 0,
      lastPlayAt: null,
    };
  }

  async find(id: number) {
    const { rows } = await this.pool.query<{ id: number; role: string; deleted_at: Date | null }>(
      `SELECT id, role, deleted_at FROM "user" WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? { id: row.id, role: row.role === "admin" ? ("admin" as const) : ("assinante" as const), deletedAt: row.deleted_at } : null;
  }

  async countActiveAdmins(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM "user" WHERE role = 'admin' AND deleted_at IS NULL`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async remove(id: number): Promise<void> {
    // O authenticate já recusa sessões de usuário removido; apagar as sessões deixa isso explícito no banco.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE "user" SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
      await client.query(`DELETE FROM session WHERE user_id = $1`, [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
