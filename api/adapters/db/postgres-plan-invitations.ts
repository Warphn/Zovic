import type { Pool } from "pg";
import { BusinessRuleError, NotFoundError } from "../../domain/errors/domain-error.ts";
import type {
  InvitationDetails,
  NewInvitation,
  PendingInvitation,
  PlanMember,
  PlanRoster,
} from "../../domain/ports/subscription-repository.ts";
import { hasFreeSlot } from "../../domain/shared/plan-invitation.ts";
import { inTransaction } from "./sql.ts";

// Primeiro argumento do pg_advisory_xact_lock para o lock de um plano. Quem precisa dos dois
// locks (aceitar convite) pega primeiro o da conta e depois o do plano, sempre nessa ordem.
export const PLAN_LOCK_NAMESPACE = 86;

// Pendente = nem usado, nem cancelado, dentro da validade. O parâmetro $2 é sempre o instante atual.
const PENDING_INVITATION = "pi.accepted_at IS NULL AND pi.canceled_at IS NULL AND pi.expires_at > $2";

// A remoção de uma conta é lógica (user.deleted_at) e o vínculo em plan_user fica: por isso
// membro, vaga e email de membro só contam contas ativas.
export async function findRoster(pool: Pool, planId: number, now: Date): Promise<PlanRoster> {
  const { rows: planRows } = await pool.query<{ user_amount: number }>(
    `SELECT pt.user_amount FROM plan p JOIN plan_type pt ON pt.id = p.type_id WHERE p.id = $1`,
    [planId],
  );
  const plan = planRows[0];
  if (!plan) {
    throw new NotFoundError("Plan not found");
  }

  const { rows: memberRows } = await pool.query<{ id: number; name: string; email: string | null; is_admin: boolean }>(
    `SELECT u.id, u.name, u.email, pu.is_admin
     FROM plan_user pu JOIN "user" u ON u.id = pu.user_id
     WHERE pu.plan_id = $1 AND u.deleted_at IS NULL
     ORDER BY pu.is_admin DESC, u.name, u.id`,
    [planId],
  );
  const { rows: invitationRows } = await pool.query<{ id: number; email: string; expires_at: Date }>(
    `SELECT pi.id, pi.email, pi.expires_at
     FROM plan_invitation pi
     WHERE pi.plan_id = $1 AND ${PENDING_INVITATION}
     ORDER BY pi.created_at, pi.id`,
    [planId, now],
  );

  const members: PlanMember[] = memberRows.map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    isManager: row.is_admin,
  }));
  const pendingInvitations: PendingInvitation[] = invitationRows.map((row) => ({
    id: row.id,
    email: row.email,
    expiresAt: row.expires_at,
  }));
  return { limit: plan.user_amount, members, pendingInvitations };
}

export async function createInvitation(pool: Pool, invitation: NewInvitation): Promise<PendingInvitation> {
  let created: PendingInvitation | undefined;

  await inTransaction(pool, async (client) => {
    // Dois convites simultâneos do mesmo plano se enfileiram aqui; o segundo enxerga o primeiro.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [PLAN_LOCK_NAMESPACE, invitation.planId]);

    const { rows } = await client.query<{
      user_amount: number;
      member_count: number;
      pending_count: number;
      is_member: boolean;
      has_pending: boolean;
    }>(
      `SELECT pt.user_amount,
         (SELECT count(*)::int FROM plan_user pu JOIN "user" u ON u.id = pu.user_id
          WHERE pu.plan_id = p.id AND u.deleted_at IS NULL) AS member_count,
         (SELECT count(*)::int FROM plan_invitation pi WHERE pi.plan_id = p.id AND ${PENDING_INVITATION}) AS pending_count,
         EXISTS (SELECT 1 FROM plan_user pu JOIN "user" u ON u.id = pu.user_id
                 WHERE pu.plan_id = p.id AND u.deleted_at IS NULL AND u.email = $3) AS is_member,
         EXISTS (SELECT 1 FROM plan_invitation pi
                 WHERE pi.plan_id = p.id AND pi.email = $3 AND ${PENDING_INVITATION}) AS has_pending
       FROM plan p JOIN plan_type pt ON pt.id = p.type_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [invitation.planId, invitation.now, invitation.email],
    );
    const state = rows[0];
    if (!state) {
      throw new NotFoundError("No active subscription");
    }
    if (state.is_member) {
      throw new BusinessRuleError("This email is already a member of the plan");
    }
    if (state.has_pending) {
      throw new BusinessRuleError("This email already has a pending invitation");
    }
    if (!hasFreeSlot(state.user_amount, state.member_count, state.pending_count)) {
      throw new BusinessRuleError("The plan has no free slots");
    }

    const { rows: inserted } = await client.query<{ id: number }>(
      `INSERT INTO plan_invitation (plan_id, email, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [invitation.planId, invitation.email, invitation.tokenHash, invitation.expiresAt, invitation.now],
    );
    const row = inserted[0];
    if (!row) {
      throw new Error("Could not create the invitation");
    }
    created = { id: row.id, email: invitation.email, expiresAt: invitation.expiresAt };
  });

  if (!created) {
    throw new Error("Could not create the invitation");
  }
  return created;
}

export async function cancelInvitation(
  pool: Pool,
  planId: number,
  invitationId: number,
  now: Date,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE plan_invitation pi SET canceled_at = $2
     WHERE pi.id = $1 AND pi.plan_id = $3 AND ${PENDING_INVITATION}`,
    [invitationId, now, planId],
  );
  return rowCount === 1;
}

export async function findPendingInvitationByTokenHash(
  pool: Pool,
  tokenHash: string,
  now: Date,
): Promise<InvitationDetails | null> {
  const { rows } = await pool.query<{
    id: number;
    plan_id: number;
    email: string;
    expires_at: Date;
    manager_name: string;
  }>(
    `SELECT pi.id, pi.plan_id, pi.email, pi.expires_at, manager.name AS manager_name
     FROM plan_invitation pi
     JOIN plan p ON p.id = pi.plan_id AND p.deleted_at IS NULL
     JOIN plan_user pu ON pu.plan_id = p.id AND pu.is_admin
     JOIN "user" manager ON manager.id = pu.user_id
     WHERE pi.token_hash = $1 AND ${PENDING_INVITATION}
     LIMIT 1`,
    [tokenHash, now],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return { id: row.id, planId: row.plan_id, email: row.email, managerName: row.manager_name, expiresAt: row.expires_at };
}
