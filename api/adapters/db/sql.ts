import { DatabaseError, type Pool, type PoolClient } from "pg";
import type { DomainError } from "../../domain/errors/domain-error.ts";

/** Reserva o próximo id da coluna identity `id` da tabela. */
export async function nextId(pool: Pool, table: string): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id",
    [table],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Could not reserve an id for ${table}`);
  }
  return Number(row.id);
}

/** Roda `work` numa transação: COMMIT se tudo der certo, ROLLBACK e relança o erro se algo falhar. */
export async function inTransaction(pool: Pool, work: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await work(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface LinkTable {
  table: string;
  /** Coluna que aponta para o dono do vínculo (quem está sendo salvo). */
  owner: string;
  /** Coluna que aponta para o outro lado. */
  other: string;
}

/** Regrava os vínculos de uma tabela associativa: apaga os do dono e insere `ids`. */
export async function replaceLinks(client: PoolClient, link: LinkTable, ownerId: number, ids: readonly number[]): Promise<void> {
  await client.query(`DELETE FROM ${link.table} WHERE ${link.owner} = $1`, [ownerId]);
  await client.query(
    `INSERT INTO ${link.table} (${link.owner}, ${link.other}) SELECT $1, unnest($2::integer[])`,
    [ownerId, ids],
  );
}

/** Troca o erro do Postgres pelo erro de domínio da constraint violada, se houver um mapeado. */
export function translateConstraintError(error: unknown, byConstraint: Record<string, () => DomainError>): unknown {
  if (error instanceof DatabaseError && error.constraint) {
    const translate = byConstraint[error.constraint];
    if (translate) return translate();
  }
  return error;
}
