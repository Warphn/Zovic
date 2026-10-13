/**
 * Os seeders, na ordem em que rodam, e o ambiente de cada um.
 *
 *   LOCAL → só no banco local. Dados fictícios; o banco é limpo antes.
 *   PROD  → só em produção.
 *   ALL   → nos dois. Dados reais do produto: inseridos ou atualizados pelo
 *           nome, nunca apagados. Não podem depender de um seeder LOCAL.
 *
 * Para mudar onde um seeder roda, troque o `env` dele aqui.
 */
import { seedCatalog } from "./catalog.ts";
import { seedGenres } from "./genres.ts";
import { seedInteractions } from "./interactions.ts";
import { seedPlanTypes } from "./plan-types.ts";
import { seedPlans } from "./plans.ts";
import { seedPlaylists } from "./playlists.ts";
import type { Seeder } from "./support.ts";
import { seedSystemData } from "./system-data.ts";
import { seedUsers } from "./users.ts";

export const seeders: Seeder[] = [
  { name: "Tipos de plano", env: "ALL", run: seedPlanTypes },
  { name: "Gêneros", env: "ALL", run: seedGenres },
  { name: "Usuários", env: "LOCAL", run: seedUsers },
  { name: "Planos", env: "LOCAL", run: seedPlans },
  { name: "Catálogo", env: "LOCAL", run: seedCatalog },
  { name: "Playlists", env: "LOCAL", run: seedPlaylists },
  { name: "Interações", env: "LOCAL", run: seedInteractions },
  // Sempre por último: recalcula os totais a partir do que está no banco.
  { name: "Totais do sistema", env: "ALL", run: seedSystemData },
];
