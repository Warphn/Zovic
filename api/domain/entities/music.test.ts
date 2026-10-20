import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Music } from "./music.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "Construção", duration: 258, artistIds: [7], now };

describe("Music.create", () => {
  it("cria com as estatísticas zeradas", () => {
    expect(Music.create(valid).toData()).toEqual({
      id: 1,
      name: "Construção",
      duration: 258,
      lyricsId: null,
      streams: 0,
      rating: null,
      artistIds: [7],
      genreIds: [],
      createdAt: now,
      deletedAt: null,
    });
  });

  it("exige ao menos um artista", () => {
    expect(() => Music.create({ ...valid, artistIds: [] })).toThrow(ValidationError);
  });

  it.each([0, -5, 1.5])("recusa a duração %p", (duration) => {
    expect(() => Music.create({ ...valid, duration })).toThrow(ValidationError);
  });

  it("recusa lyricsId inválido", () => {
    expect(() => Music.create({ ...valid, lyricsId: 0 })).toThrow(ValidationError);
  });

  it.each(["", "a".repeat(256)])("recusa o nome %p", (name) => {
    expect(() => Music.create({ ...valid, name })).toThrow(ValidationError);
  });
});

describe("Music depois de criada", () => {
  it("renomeia, muda a duração e os vínculos", () => {
    const music = Music.create(valid);
    music.rename(" Cotidiano ");
    music.changeDuration(170);
    music.addArtist(8);
    music.addGenre(3);
    music.removeArtist(7);
    expect(music.name).toBe("Cotidiano");
    expect(music.duration).toBe(170);
    expect(music.artistIds).toEqual([8]);
    expect(music.genreIds).toEqual([3]);
  });

  it("não remove o último artista", () => {
    const music = Music.create(valid);
    expect(() => music.removeArtist(7)).toThrow(BusinessRuleError);
  });

  it("restore mantém as estatísticas", () => {
    const music = Music.restore({ ...Music.create(valid).toData(), streams: 42, rating: 4.5 });
    expect(music.streams).toBe(42);
    expect(music.rating).toBe(4.5);
  });

  it("não aceita mudanças depois de apagada", () => {
    const music = Music.create(valid);
    music.delete(now);
    expect(() => music.changeDuration(10)).toThrow(BusinessRuleError);
  });
});
