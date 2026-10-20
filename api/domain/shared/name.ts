import { ValidationError } from "../errors/domain-error.ts";

/** Tira os espaços das pontas e confere se o nome não está vazio nem passa do limite. */
export function validateName(name: string, maxLength: number, label: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${label} name cannot be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${label} name cannot exceed ${maxLength} characters`);
  }
  return trimmed;
}
