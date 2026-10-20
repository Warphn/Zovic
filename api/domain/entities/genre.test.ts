import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Genre } from "./genre.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "MPB", color: "#ff8800", now };

describe("Genre.create", () => {
  it("cria com a cor normalizada", () => {
    expect(Genre.create(valid).toData()).toEqual({
      id: 1,
      name: "MPB",
      color: "#FF8800",
      createdAt: now,
      deletedAt: null,
    });
  });

  it.each(["", "   ", "a".repeat(101)])("recusa o nome %p", (name) => {
    expect(() => Genre.create({ ...valid, name })).toThrow(ValidationError);
  });

  it("recusa cor inválida", () => {
    expect(() => Genre.create({ ...valid, color: "laranja" })).toThrow(ValidationError);
  });
});

describe("Genre depois de criado", () => {
  it("renomeia e troca a cor", () => {
    const genre = Genre.create(valid);
    genre.rename("  Samba ");
    genre.changeColor("#00aa00");
    expect(genre.name).toBe("Samba");
    expect(genre.color).toBe("#00AA00");
  });

  it("não aceita mudanças depois de apagado", () => {
    const genre = Genre.create(valid);
    genre.delete(now);
    expect(genre.deletedAt).toEqual(now);
    expect(() => genre.rename("Samba")).toThrow(BusinessRuleError);
    expect(() => genre.delete()).toThrow(BusinessRuleError);
  });
});
