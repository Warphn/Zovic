import type { Prisma } from "../../generated/prisma/client.ts";

export type Tx = Prisma.TransactionClient;

/**
 * Onde um seeder roda:
 *   LOCAL → só no banco local. Dados fictícios; o banco é limpo antes.
 *   PROD  → só em produção.
 *   ALL   → nos dois. Dados reais do produto: inseridos ou atualizados, nunca apagados.
 */
export type SeedEnv = "LOCAL" | "PROD" | "ALL";

export interface Seeder {
  name: string;
  env: SeedEnv;
  run: (tx: Tx) => Promise<string>;
}

/** Data de referência fixa: os dados não dependem do dia em que o seed roda. */
const BASE = Date.UTC(2026, 0, 5, 12);
const HOUR = 3_600_000;

/** `day(3, 2)` = 3 dias e 2 horas depois da data de referência. */
export const day = (days: number, hours = 0) => new Date(BASE + (days * 24 + hours) * HOUR);

/** Gerador pseudoaleatório com semente fixa (mulberry32): a mesma sequência em toda execução. */
export function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    int,
    chance: (probability: number) => next() < probability,
    pick: <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!,
    /** `n` itens distintos, em ordem embaralhada. */
    sample: <T>(items: readonly T[], n: number): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy.slice(0, n);
    },
  };
}

/** Mapa nome → id, para ligar registros pelo nome em vez de por id fixo. */
export const byName = (rows:
                       {
                         id: number;
                         name: string
                       }[]) => new Map(rows.map((row) => [row.name, row.id]));

export function idOf(ids: Map<string, number>, name: string): number {
  const id = ids.get(name);
  if (id === undefined) throw new Error(`Seed: "${name}" não existe no banco.`);
  return id;
}
