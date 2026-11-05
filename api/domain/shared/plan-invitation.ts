import { createHash, randomBytes } from "node:crypto";

export const INVITATION_VALIDITY_DAYS = 7;
const INVITATION_TOKEN_BYTES = 32;
/** O token tem 43 caracteres base64url; o limite só evita processar um valor enorme. */
export const INVITATION_TOKEN_MAX_LENGTH = 200;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Token em claro do link do convite. Só o hash dele é guardado. */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

/** SHA-256 em hex. O token já é aleatório, então não precisa de salt. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** O email do convite é guardado em minúsculas, como o da conta. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function invitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_VALIDITY_DAYS * MILLISECONDS_PER_DAY);
}

/** Há vaga para mais uma pessoa? Convite pendente ocupa vaga como um membro. */
export function hasFreeSlot(limit: number, memberCount: number, pendingInvitationCount: number): boolean {
  return memberCount + pendingInvitationCount < limit;
}
