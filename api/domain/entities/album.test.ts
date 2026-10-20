import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Album } from "./album.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "Construção", artistIds: [7], now };

describe("Album.create", () => {
  it("cria com os vínculos vazios por padrão", () => {
    expect(Album.create(valid).toData()).toEqual({
      id: 1,
      name: "Construção",
      artistIds: [7],
      genreIds: [],
      musicIds: [],
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
});

describe("Album depois de criado", () => {
  it("adiciona e remove artistas, gêneros e músicas", () => {
    const album = Album.create(valid);
    album.addArtist(8);
    album.addGenre(3);
    album.addMusic(10);
    album.addMusic(11);
    album.removeArtist(7);
    album.removeMusic(10);
    expect(album.artistIds).toEqual([8]);
    expect(album.genreIds).toEqual([3]);
    expect(album.musicIds).toEqual([11]);
  });

  it("não remove o último artista", () => {
    const album = Album.create(valid);
    expect(() => album.removeArtist(7)).toThrow(BusinessRuleError);
  });

  it("toData devolve uma cópia", () => {
    const album = Album.create(valid);
    album.toData().artistIds.push(99);
    expect(album.artistIds).toEqual([7]);
  });

  it("não aceita mudanças depois de apagado", () => {
    const album = Album.create(valid);
    album.delete(now);
    expect(() => album.addMusic(1)).toThrow(BusinessRuleError);
  });
});
