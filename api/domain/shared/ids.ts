import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";

/** Confere se os ids são inteiros positivos e tira os repetidos, mantendo a ordem. */
export function normalizeIds(ids: readonly number[], label: string): number[] {
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError(`${label} id must be a positive integer`);
    }
  }
  return [...new Set(ids)];
}

/** Devolve a lista com o id a mais; recusa id que já está nela. */
export function addId(ids: readonly number[], id: number, label: string): number[] {
  const [valid] = normalizeIds([id], label);
  if (ids.includes(valid!)) {
    throw new BusinessRuleError(`${label} ${id} is already linked`);
  }
  return [...ids, valid!];
}

/** Devolve a lista sem o id; recusa id que não está nela. */
export function removeId(ids: readonly number[], id: number, label: string): number[] {
  if (!ids.includes(id)) {
    throw new BusinessRuleError(`${label} ${id} is not linked`);
  }
  return ids.filter((other) => other !== id);
}
