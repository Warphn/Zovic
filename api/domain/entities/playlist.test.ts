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
  });
});