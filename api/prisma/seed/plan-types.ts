/**
 * Tipos de plano do produto (ALL: rodam também em produção).
 *
 * Inserem os que faltam e atualizam preço e limite dos que mudaram, pelo nome.
 * Um tipo que sair desta lista NÃO é apagado: desative-o com uma migration.
 */
import type { Seeder } from "./support.ts";

export const PLAN_TYPES = [
  { name: "Individual", price: "12.99", userAmount: 1 },
  { name: "Família", price: "29.99", userAmount: 6 },
] as const;

export const seedPlanTypes: Seeder["run"] = async (tx) => {
  let created = 0;
  let updated = 0;
  for (const type of PLAN_TYPES) {
    const current = await tx.planType.findFirst({ where: { name: type.name, deletedAt: null } });
    if (!current) {
      await tx.planType.create({ data: type });
      created++;
    } else if (current.price.toFixed(2) !== type.price || current.userAmount !== type.userAmount) {
      await tx.planType.update({ where: { id: current.id }, data: type });
      updated++;
    }
  }
  return `${PLAN_TYPES.length} tipos (${created} criados, ${updated} atualizados)`;
};
