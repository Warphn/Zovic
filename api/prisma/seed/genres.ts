/**
 * Gêneros musicais do produto (ALL: rodam também em produção).
 *
 * Inserem os que faltam e atualizam a cor dos que mudaram, pelo nome.
 * Um gênero que sair desta lista NÃO é apagado.
 */
import type { Seeder } from "./support.ts";

/** Cores no formato #RRGGBB (o banco recusa outro formato). */
export const GENRES = [
  { name: "Rock", color: "#241d1d" },
  { name: "Pop", color: "#b500ff" },
  { name: "MPB", color: "#35adde" },
  { name: "Samba", color: "#ffd80b" },
  { name: "Sertanejo", color: "#e56f1e" },
  { name: "Funk", color: "#e01c56" },
  { name: "Hip-Hop", color: "#063eb3" },
  { name: "Eletrônica", color: "#2dff00" },
  { name: "Jazz", color: "#efa300" },
] as const;

export const seedGenres: Seeder["run"] = async (tx) => {
  let created = 0;
  let updated = 0;
  for (const genre of GENRES) {
    const current = await tx.genre.findFirst({ where: { name: genre.name, deletedAt: null } });
    if (!current) {
      await tx.genre.create({ data: genre });
      created++;
    } else if (current.color !== genre.color) {
      await tx.genre.update({ where: { id: current.id }, data: { color: genre.color } });
      updated++;
    }
  }
  return `${GENRES.length} gêneros (${created} criados, ${updated} atualizados)`;
};
