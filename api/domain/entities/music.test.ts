import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Music } from "./music.ts";

const now = new Date("2026-10-20T12:00:00Z");
const valid = { id: 1, name: "Construção", duration: 258, artistIds: [7], audioFile: "construcao.mp3", now };

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
      audioFile: "construcao.mp3",
      isExplicit: false,
      albumId: null,
      createdAt: now,
      deletedAt: null,
    });
  });

  it("exige o arquivo de áudio", () => {
    expect(() => Music.create({ ...valid, audioFile: "" })).toThrow(new ValidationError("Music must have an audio file"));
  });

  it("guarda o álbum e a marca de explícito", () => {
    const music = Music.create({ ...valid, albumId: 3, isExplicit: true });
    expect(music.albumId).toBe(3);
    expect(music.isExplicit).toBe(true);
  });

  it.each([0, -1, 2.5])("recusa o albumId %p", (albumId) => {
    expect(() => Music.create({ ...valid, albumId })).toThrow(new ValidationError("Album id must be a positive integer"));
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
  it("troca e tira o álbum", () => {
    const music = Music.create(valid);
    music.changeAlbum(7);
    expect(music.albumId).toBe(7);
    music.changeAlbum(null);
    expect(music.albumId).toBeNull();
    expect(() => music.changeAlbum(0)).toThrow(ValidationError);
  });

  it("marca e desmarca o conteúdo explícito", () => {
    const music = Music.create(valid);
    music.setExplicit(true);
    expect(music.isExplicit).toBe(true);
    music.setExplicit(false);
    expect(music.isExplicit).toBe(false);
  });

  it("restore aceita uma música antiga, sem áudio", () => {
    const music = Music.restore({ ...Music.create(valid).toData(), audioFile: null });
    expect(music.audioFile).toBeNull();
  });

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
    expect(() => music.changeAlbum(2)).toThrow(BusinessRuleError);
    expect(() => music.setExplicit(true)).toThrow(BusinessRuleError);
  });
});
