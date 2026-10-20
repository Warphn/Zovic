import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Artist } from "./artist.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "Chico Buarque", now };

describe("Artist", () => {
  it("cria com os valores padrão", () => {
    expect(Artist.create(valid).toData()).toEqual({ id: 1, name: "Chico Buarque", createdAt: now, deletedAt: null });
  });

  it.each(["", "   ", "a".repeat(256)])("recusa o nome %p", (name) => {
    expect(() => Artist.create({ ...valid, name })).toThrow(ValidationError);
  });

  it("renomeia", () => {
    const artist = Artist.create(valid);
    artist.rename(" Chico ");
    expect(artist.name).toBe("Chico");
  });

  it("não aceita mudanças depois de apagado", () => {
    const artist = Artist.create(valid);
    artist.delete(now);
    expect(() => artist.rename("Outro")).toThrow(BusinessRuleError);
  });
});
