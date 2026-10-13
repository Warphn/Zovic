/**
 * Planos assinados e seus membros (LOCAL).
 *
 * Regras do modelo, conferidas antes de gravar:
 *   - todo plano tem ao menos um usuário e um admin;
 *   - nenhum plano passa do limite de usuários do seu tipo;
 *   - todo usuário está em ao menos um plano;
 *   - todo tipo de plano tem ao menos um plano.
 */
import { USERS } from "./users.ts";
import { byName, day, idOf, type Seeder } from "./support.ts";

const PLANS = [
  { name: "Família Andrade", type: "Família", admins: ["Ana Andrade"], members: ["Bruno Andrade", "Carla Andrade", "Diego Andrade", "Elisa Andrade"] },
  { name: "Família Costa", type: "Família", admins: ["Felipe Costa", "Gabriela Costa"], members: ["Heitor Costa", "Isabela Costa"] },
  { name: "Individual Pedro", type: "Individual", admins: ["Pedro Nogueira"], members: [] },
  { name: "Individual Rafaela", type: "Individual", admins: ["Rafaela Dias"], members: [] },
  { name: "Individual Sofia", type: "Individual", admins: ["Sofia Teixeira"], members: [] },
  { name: "Individual Tiago", type: "Individual", admins: ["Tiago Moura"], members: [] },
  { name: "Individual Vitória", type: "Individual", admins: ["Vitória Campos"], members: [] },
] as const;

export const seedPlans: Seeder["run"] = async (tx) => {
  const types = await tx.planType.findMany({ where: { deletedAt: null } });
  const typeIds = byName(types);
  const userIds = byName(await tx.user.findMany({ select: { id: true, name: true } }));

  const inSomePlan = new Set(PLANS.flatMap((plan) => [...plan.admins, ...plan.members]));
  const withoutPlan = USERS.filter((user) => !inSomePlan.has(user.name)).map((user) => user.name);
  if (withoutPlan.length) throw new Error(`Seed: usuários sem plano: ${withoutPlan.join(", ")}`);
  const unusedTypes = types.filter((type) => !PLANS.some((plan) => plan.type === type.name)).map((type) => type.name);
  if (unusedTypes.length) throw new Error(`Seed: tipos de plano sem nenhum plano: ${unusedTypes.join(", ")}`);

  for (const [i, plan] of PLANS.entries()) {
    const limit = types.find((type) => type.name === plan.type)?.userAmount ?? 0;
    const size = plan.admins.length + plan.members.length;
    if (size > limit) throw new Error(`Seed: "${plan.name}" tem ${size} usuários; o tipo ${plan.type} permite ${limit}.`);

    await tx.plan.create({
      data: {
        name: plan.name,
        typeId: idOf(typeIds, plan.type),
        createdAt: day(i),
        users: {
          create: [
            ...plan.admins.map((name) => ({ userId: idOf(userIds, name), isAdmin: true })),
            ...plan.members.map((name) => ({ userId: idOf(userIds, name), isAdmin: false })),
          ],
        },
      },
    });
  }
  return `${PLANS.length} planos, ${inSomePlan.size} usuários vinculados`;
};
