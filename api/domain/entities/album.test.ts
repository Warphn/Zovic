import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Album } from "./album.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "Construção", artistIds: [7], year: 1971, now };

describe("Album.create", () => {
  it("cria com os vínculos vazios por padrão", () => {
    expect(Album.create(valid).toData()).toEqual({
      id: 1,
      name: "Construção",
      artistIds: [7],
      genreIds: [],
      year: 1971,
      createdAt: now,
      deletedAt: null,
    });
  });

  it("exige ao menos um artista", () => {
    expect(() => Album.create({ ...valid, artistIds: [] })).toThrow(ValidationError);
  });

  it("tira ids repetidos", () => {
    expect(Album.create({ ...valid, artistIds: [7, 7, 8] }).artistIds).toEqual([7, 8]);
  });

  it.each(["", "a".repeat(256)])("recusa o nome %p", (name) => {
    expect(() => Album.create({ ...valid, name })).toThrow(ValidationError);
  });

  it.each([Album.MIN_YEAR, 2026])("aceita o ano %p, entre 1900 e o ano atual", (year) => {
    expect(Album.create({ ...valid, year }).year).toBe(year);
  });

  it.each([1899, 2027, 1971.5])("recusa o ano %p", (year) => {
    expect(() => Album.create({ ...valid, year })).toThrow(
      new ValidationError("Album year must be between 1900 and 2026"),
    );
  });
});

describe("Album.restore", () => {
  it("aceita um álbum antigo, sem ano", () => {
    const album = Album.restore({ ...Album.create(valid).toData(), year: null });
    expect(album.year).toBeNull();
  });
});

describe("Album depois de criado", () => {
  it("adiciona e remove artistas e gêneros", () => {
    const album = Album.create(valid);
    album.addArtist(8);
    album.addGenre(3);
    album.removeArtist(7);
    expect(album.artistIds).toEqual([8]);
    expect(album.genreIds).toEqual([3]);
  });

  it("não remove o último artista", () => {
    const album = Album.create(valid);
    expect(() => album.removeArtist(7)).toThrow(BusinessRuleError);
  });

  it("troca o ano com a mesma regra do cadastro", () => {
    const album = Album.create(valid);
    album.changeYear(1984, now);
    expect(album.year).toBe(1984);
    expect(() => album.changeYear(2027, now)).toThrow(ValidationError);
  });

  it("toData devolve uma cópia", () => {
    const album = Album.create(valid);
    album.toData().artistIds.push(99);
    expect(album.artistIds).toEqual([7]);
  });

  it("não aceita mudanças depois de apagado", () => {
    const album = Album.create(valid);
    album.delete(now);
    expect(() => album.addGenre(1)).toThrow(BusinessRuleError);
    expect(() => album.changeYear(1980, now)).toThrow(BusinessRuleError);
  });
});
