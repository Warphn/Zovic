import type { Pool } from "pg";

/** Assina o plano individual: as rotas do catálogo só aceitam quem tem assinatura ativa. */
export async function subscribeAccount(baseUrl: string, cookie: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/plans`, { method: "POST", headers: { Cookie: cookie } });
  if (res.status !== 201) throw new Error(`Subscribe failed with ${res.status}`);
}

/** Apaga os planos das contas do teste. Remover o usuário tira só o plan_user, e o plano ficaria órfão. */
export async function deletePlansOfAccounts(pool: Pool, emailPattern: string): Promise<void> {
  await pool.query(
    `DELETE FROM plan WHERE id IN (
       SELECT pu.plan_id FROM plan_user pu JOIN "user" u ON u.id = pu.user_id WHERE u.email LIKE $1)`,
    [emailPattern],
  );
}
