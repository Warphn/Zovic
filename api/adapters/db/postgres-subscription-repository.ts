import { DatabaseError, type Pool, type PoolClient } from "pg";
import { BusinessRuleError, NotFoundError } from "../../domain/errors/domain-error.ts";
import type { ActiveSubscription, SubscriptionRepository } from "../../domain/ports/subscription-repository.ts";

const FOREIGN_KEY_VIOLATION = "23503";
const INDIVIDUAL_TYPE_NAME = "Individual";
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

  async createIndividual(userId: number, startedAt: Date): Promise<ActiveSubscription> {
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
        [userId, startedAt, INDIVIDUAL_TYPE_NAME],
      );
      const created = rows[0];
      if (!created) {
        await assertUserAndPlanTypeExist(client, userId);
        throw new Error("Could not create the subscription");
      }

      await client.query("COMMIT");
      return { planId: created.id, kind: "individual", isManager: true, startedAt };
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

async function assertUserAndPlanTypeExist(client: PoolClient, userId: number): Promise<void> {
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
