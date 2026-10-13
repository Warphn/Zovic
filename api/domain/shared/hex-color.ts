import { ValidationError } from "../errors/domain-error.ts";

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(hexColor: string): string {
    const trimmedColor = hexColor.trim();
    if (!HEX_COLOR_PATTERN.test(trimmedColor)) {
        throw new ValidationError(`Invalid hex color: ${trimmedColor}`);
    }
  return trimmedColor.toUpperCase();
}
