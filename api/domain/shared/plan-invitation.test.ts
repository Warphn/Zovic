import { describe, expect, it } from "bun:test";
import {
  generateInvitationToken,
  hasFreeSlot,
  hashInvitationToken,
  INVITATION_VALIDITY_DAYS,
  invitationExpiresAt,
  normalizeEmail,
} from "./plan-invitation.ts";

describe("generateInvitationToken", () => {
  it("gera 32 bytes em base64url, sem repetir", () => {
    const token = generateInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInvitationToken()).not.toBe(token);
  });
});

describe("hashInvitationToken", () => {
  it("devolve o SHA-256 em hex, sempre o mesmo para o mesmo token", () => {
    expect(hashInvitationToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("normalizeEmail", () => {
  it("apara espaços e põe em minúsculas", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });
});

describe("invitationExpiresAt", () => {
  it("vale 7 dias a partir de agora", () => {
    const now = new Date("2026-11-05T12:00:00.000Z");

    expect(INVITATION_VALIDITY_DAYS).toBe(7);
    expect(invitationExpiresAt(now).toISOString()).toBe("2026-11-12T12:00:00.000Z");
  });
});

describe("hasFreeSlot", () => {
  it.each([
    { limit: 4, members: 1, pending: 2, expected: true },
    { limit: 4, members: 2, pending: 2, expected: false },
    { limit: 4, members: 4, pending: 0, expected: false },
    { limit: 4, members: 0, pending: 4, expected: false },
    { limit: 1, members: 1, pending: 0, expected: false },
  ])("limite $limit, $members membros e $pending convites: $expected", ({ limit, members, pending, expected }) => {
    expect(hasFreeSlot(limit, members, pending)).toBe(expected);
  });
});
