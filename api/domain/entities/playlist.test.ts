import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { Playlist } from "./playlist.ts";

const now = new Date("2026-10-13T12:00:00Z");
const valid = { id: 1, creatorId: 7, name: "Rock", now };

describe("Playlist.create", () => {
  it("cria com os valores padrão e o criador como admin", () => {
    expect(Playlist.create(valid).toData()).toEqual({
      id: 1,
      name: "Rock",
      isPrivate: false,
      color: null,
      members: [{ userId: 7, isAdmin: true }],
      createdAt: now,
      deletedAt: null,
    });
  });

  it("tira os espaços das pontas do nome", () => {
    expect(Playlist.create({ ...valid, name: "  Rock  " }).name).toBe("Rock");
  });

  it.each(["", "   ", "a".repeat(151)])("recusa o nome %p", (name) => {
    expect(() => Playlist.create({ ...valid, name })).toThrow(ValidationError);
  });

  it("normaliza a cor", () => {
    expect(Playlist.create({ ...valid, color: "#ff8800" }).color).toBe("#FF8800");
  });

  it("recusa cor inválida", () => {
    expect(() => Playlist.create({ ...valid, color: "azul" })).toThrow(ValidationError
  ,);});
});

describe("Playlist.toData", () => {
  it("devolve uma cópia: mexer nela não altera a playlist", () => {
    const playlist = Playlist.create(valid);
    playlist.toData().members.push({ userId: 99, isAdmin: true });
    expect(playlist.toData().members).toHaveLength(1);
  });
});

describe("membros", () => {
  it("adiciona um membro comum", () => {
    const playlist = Playlist.create(valid);
    playlist.addMember(8);
    expect(playlist.isMember(8)).toBe(true);
    expect(playlist.isAdmin(8)).toBe(false);
  });

  it("recusa membro repetido", () => {
    const playlist = Playlist.create(valid);
    expect(() => playlist.addMember(7)).toThrow(BusinessRuleError);
  });

  it("não remove o último admin", () => {
    const playlist = Playlist.create(valid);
    playlist.addMember(8);
    expect(() => playlist.removeMember(7)).toThrow(BusinessRuleError);
  });

  it("remove o admin original depois de promover outro", () => {
    const playlist = Playlist.create(valid);
    playlist.addMember(8);
    playlist.promote(8);
    playlist.removeMember(7);
    expect(playlist.members).toEqual([{ userId: 8, isAdmin: true }]);
  });
});

describe("playlist apagada", () => {
  it("não aceita alterações", () => {
    const playlist = Playlist.create(valid);
    playlist.delete(now);
    expect(playlist.deletedAt).toEqual(now);
    expect(() => playlist.rename("Jazz")).toThrow(BusinessRuleError);
    expect(() => playlist.changeCover("capa.png")).toThrow(BusinessRuleError);
  });
});

// HU-35: a capa é opcional, e a playlist sem capa mostra as iniciais sobre a cor
describe("capa da playlist", () => {
  it("começa sem capa, troca e remove", () => {
    const playlist = Playlist.create(valid);
    expect(playlist.coverFile).toBeNull();

    playlist.changeCover("capa.png");
    expect(playlist.coverFile).toBe("capa.png");

    playlist.removeCover();
    expect(playlist.coverFile).toBeNull();
  });

  it("recusa um nome de arquivo vazio", () => {
    expect(() => Playlist.create(valid).changeCover(" ")).toThrow(ValidationError);
  });
});
// HU-34: a playlist fixa de cada conta, alimentada pela curtida
describe("Músicas Curtidas", () => {
  it("cria a Músicas Curtidas privada, com o nome, a cor e o dono", () => {
    const likedSongs = Playlist.createLikedSongs({ id: 3, userId: 7, now });

    expect(likedSongs.toData()).toMatchObject({
      id: 3,
      name: "Músicas Curtidas",
      isPrivate: true,
      color: "#D33A2C",
      members: [{ userId: 7, isAdmin: true }],
      likedByUserId: 7,
    });
    expect(likedSongs.isLikedSongs).toBe(true);
  });

  it("a Músicas Curtidas não é renomeada, não muda de cor nem de visibilidade, não é apagada e não recebe membros", () => {
    const likedSongs = Playlist.createLikedSongs({ id: 3, userId: 7, now });

    expect(() => likedSongs.rename("Outra")).toThrow(BusinessRuleError);
    expect(() => likedSongs.changeColor("#112233")).toThrow(BusinessRuleError);
    expect(() => likedSongs.setPrivate(false)).toThrow(BusinessRuleError);
    expect(() => likedSongs.delete(now)).toThrow(BusinessRuleError);
    expect(() => likedSongs.addMember(8)).toThrow(BusinessRuleError);
    expect(() => likedSongs.changeCover("capa.png")).toThrow(BusinessRuleError);
    expect(() => likedSongs.removeCover()).toThrow(BusinessRuleError);
    expect(likedSongs.name).toBe("Músicas Curtidas");
    expect(likedSongs.coverFile).toBeNull();
  });

  it("uma playlist comum não é a Músicas Curtidas", () => {
    expect(Playlist.create(valid).isLikedSongs).toBe(false);
  });
});
