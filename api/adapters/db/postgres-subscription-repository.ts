import { DatabaseError, type Pool, type PoolClient } from "pg";
import { BusinessRuleError, NotFoundError } from "../../domain/errors/domain-error.ts";
import type {
  AcceptInvitationCommand,
  ActiveSubscription,
  InvitationDetails,
  NewInvitation,
  PendingInvitation,
  PlanKind,
  PlanRoster,
  SubscriptionRepository,
} from "../../domain/ports/subscription-repository.ts";
import {
  cancelInvitation,
  createInvitation,
  findPendingInvitationByTokenHash,
  findRoster,
  PLAN_LOCK_NAMESPACE,
} from "./postgres-plan-invitations.ts";
import { inTransaction } from "./sql.ts";

const FOREIGN_KEY_VIOLATION = "23503";
const INDIVIDUAL_TYPE_NAME = "Individual";
const FAMILY_TYPE_NAME = "Família";
const TYPE_NAME_BY_KIND: Record<PlanKind, string> = {
  individual: INDIVIDUAL_TYPE_NAME,
  family: FAMILY_TYPE_NAME,
};
// Primeiro argumento do pg_advisory_xact_lock: separa estes locks de outros usos de advisory lock.
const SUBSCRIPTION_LOCK_NAMESPACE = 85;

interface SubscriptionRow {
  id: number;
  type_name: string;
  is_admin: boolean;
  created_at: Date;
}

// Assinatura ativa = plano sem deleted_at. Cancelar é um soft delete do plano: o plano_user
// (e as contas) ficam, só o acesso some. O plano mais recente vence se houver mais de um.
const SELECT_ACTIVE_BY_USER = `
  SELECT p.id, pt.name AS type_name, pu.is_admin, p.created_at
  FROM plan_user pu
  JOIN plan p ON p.id = pu.plan_id
  JOIN plan_type pt ON pt.id = p.type_id
  WHERE pu.user_id = $1 AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 1`;

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async findActiveByUser(userId: number): Promise<ActiveSubscription | null> {
    return findActive(this.pool, userId);
  }

  async create(userId: number, kind: PlanKind, startedAt: Date): Promise<ActiveSubscription> {
    const typeName = TYPE_NAME_BY_KIND[kind];
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      // Duas assinaturas simultâneas da mesma conta se enfileiram aqui; a segunda enxerga a primeira.
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [SUBSCRIPTION_LOCK_NAMESPACE, userId]);

      if ((await findActive(client, userId)) !== null) {
        throw new BusinessRuleError("Account already has an active subscription");
      }

      const { rows } = await client.query<{ id: number }>(
        `WITH plan_type_row AS (
           SELECT id FROM plan_type WHERE name = $3 AND deleted_at IS NULL ORDER BY id LIMIT 1
         ), owner AS (
           SELECT name FROM "user" WHERE id = $1 AND deleted_at IS NULL
         ), new_plan AS (
           INSERT INTO plan (name, type_id, created_at)
           SELECT left($3::text || ' ' || owner.name, 100), plan_type_row.id, $2::timestamptz
           FROM owner, plan_type_row
           RETURNING id
         ), new_member AS (
           INSERT INTO plan_user (plan_id, user_id, is_admin)
           SELECT id, $1, true FROM new_plan
         )
         SELECT id FROM new_plan`,
        [userId, startedAt, typeName],
      );
      const created = rows[0];
      if (!created) {
        await assertUserExists(client, userId);
        // Com o usuário existindo, o que falta é o tipo de plano, que vem do seed.
        throw new Error(`Plan type "${typeName}" not found: run the seed`);
      }

      await client.query("COMMIT");
      return { planId: created.id, kind, isManager: true, startedAt };
    } catch (error) {
      await client.query("ROLLBACK");
      throw translateError(error);
    } finally {
      client.release();
    }
  }

  async cancel(planId: number, canceledAt: Date): Promise<void> {
    await this.pool.query("UPDATE plan SET deleted_at = $2 WHERE id = $1 AND deleted_at IS NULL", [
      planId,
      canceledAt,
    ]);
  }

  async findRoster(planId: number, now: Date): Promise<PlanRoster> {
    return findRoster(this.pool, planId, now);
  }

  async createInvitation(invitation: NewInvitation): Promise<PendingInvitation> {
    return createInvitation(this.pool, invitation);
  }

  async cancelInvitation(planId: number, invitationId: number, now: Date): Promise<boolean> {
    return cancelInvitation(this.pool, planId, invitationId, now);
  }

  async findPendingInvitationByTokenHash(tokenHash: string, now: Date): Promise<InvitationDetails | null> {
    return findPendingInvitationByTokenHash(this.pool, tokenHash, now);
  }

  async acceptInvitation(command: AcceptInvitationCommand): Promise<ActiveSubscription> {
    let accepted: ActiveSubscription | null = null;

    await inTransaction(this.pool, async (client) => {
      // Ordem fixa dos locks (conta, depois plano) para dois aceites cruzados não travarem um ao outro.
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [SUBSCRIPTION_LOCK_NAMESPACE, command.userId]);
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [PLAN_LOCK_NAMESPACE, command.planId]);

      // Só um aceite consegue marcar o convite: o segundo, já enfileirado no lock, não acha linha.
      const { rowCount } = await client.query(
        `UPDATE plan_invitation pi SET accepted_at = $2
         FROM plan p
         WHERE pi.id = $1 AND p.id = pi.plan_id AND p.deleted_at IS NULL
           AND pi.accepted_at IS NULL AND pi.canceled_at IS NULL AND pi.expires_at > $2`,
        [command.invitationId, command.now],
      );
      if (rowCount !== 1) {
        throw new NotFoundError("Invitation not found");
      }

      if ((await findActive(client, command.userId)) !== null) {
        throw new BusinessRuleError("Leave or cancel your current plan before accepting an invitation");
      }

      await client.query("INSERT INTO plan_user (plan_id, user_id, is_admin) VALUES ($1, $2, false)", [
        command.planId,
        command.userId,
      ]);
      accepted = await findActive(client, command.userId);
    });

    if (!accepted) {
      throw new Error("Could not join the plan");
    }
    return accepted;
  }

  async removeMember(planId: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "DELETE FROM plan_user WHERE plan_id = $1 AND user_id = $2 AND NOT is_admin",
      [planId, userId],
    );
    return rowCount === 1;
  }
}

async function findActive(db: Pool | PoolClient, userId: number): Promise<ActiveSubscription | null> {
  const { rows } = await db.query<SubscriptionRow>(SELECT_ACTIVE_BY_USER, [userId]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    planId: row.id,
    kind: row.type_name === INDIVIDUAL_TYPE_NAME ? "individual" : "family",
    isManager: row.is_admin,
    startedAt: row.created_at,
  };
}

async function assertUserExists(client: PoolClient, userId: number): Promise<void> {
  const { rowCount } = await client.query('SELECT 1 FROM "user" WHERE id = $1 AND deleted_at IS NULL', [userId]);
  if (rowCount === 0) {
    throw new NotFoundError("User not found");
  }
}

function translateError(error: unknown): unknown {
  if (error instanceof DatabaseError && error.code === FOREIGN_KEY_VIOLATION) {
    return new NotFoundError("User not found");
  }
  return error;
}
