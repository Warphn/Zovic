/**
 * Admin padrão (LOCAL), para demonstrar o painel: email `admin@zovic.test`, senha `admin`.
 *
 * A senha tem menos que os 8 caracteres exigidos no cadastro: ela só existe porque o hash é
 * gravado direto, sem passar pela validação. Por isso este seeder nunca roda em produção.
 * Não entra em plano: admins da plataforma acessam o catálogo sem assinatura.
 *
 * Insere ou atualiza pelo email, então pode rodar de novo sem duplicar a conta.
 */
import { hashPassword } from "better-auth/crypto";
import type { Seeder } from "./support.ts";

export const ADMIN_EMAIL = "admin@zovic.test";
export const ADMIN_PASSWORD = "admin";

export const seedAdmin: Seeder["run"] = async (tx) => {
  const user = await tx.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { name: "Admin Zovic", email: ADMIN_EMAIL, birthdate: new Date("1990-01-01"), role: "admin" },
    update: { role: "admin", deletedAt: null },
  });

  // Conta de credencial como o Better Auth espera: provider "credential" e accountId = id do usuário.
  const password = await hashPassword(ADMIN_PASSWORD);
  await tx.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: String(user.id) } },
    create: { userId: user.id, providerId: "credential", accountId: String(user.id), password },
    update: { password },
  });

  return `${ADMIN_EMAIL} (senha ${ADMIN_PASSWORD})`;
};
