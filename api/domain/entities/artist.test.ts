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
    expect(() => artist.changeImage("foto.png")).toThrow(BusinessRuleError);
    expect(() => artist.removeImage()).toThrow(BusinessRuleError);
  });
});

// HU-36: a foto é opcional, e o artista sem foto aparece com as iniciais
describe("foto do artista", () => {
  it("começa sem foto, troca e remove", () => {
    const artist = Artist.create(valid);
    expect(artist.imageFile).toBeNull();

    artist.changeImage("foto.png");
    expect(artist.imageFile).toBe("foto.png");

    artist.removeImage();
    expect(artist.imageFile).toBeNull();
  });

  it("um artista anterior à coluna, sem o campo, não tem foto", () => {
    expect(Artist.restore({ id: 1, name: "Chico Buarque", createdAt: now, deletedAt: null }).imageFile).toBeNull();
  });

  it("recusa um nome de arquivo vazio", () => {
    expect(() => Artist.create(valid).changeImage("  ")).toThrow(ValidationError);
  });
});
