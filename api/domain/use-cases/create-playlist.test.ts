import { describe, expect, it } from "bun:test";
import { ValidationError } from "../errors/domain-error.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { CreatePlaylist } from "./create-playlist.ts";

function setup() {
  const repository = new InMemoryPlaylistRepository();
  return { repository, useCase: new CreatePlaylist(repository) };
}

describe("CreatePlaylist", () => {
  it("cria a playlist pública com o criador como único admin", async () => {
    const { repository, useCase } = setup();

    const output = await useCase.execute({ creatorId: 7, name: "Rock" });

    expect(output).toMatchObject({ id: 1, name: "Rock", isPrivate: false, color: null, isAdmin: true });
    expect(repository.items).toHaveLength(1);
    expect(repository.items[0]?.members).toEqual([{ userId: 7, isAdmin: true }]);
  });

  it("devolve createdAt como string ISO", async () => {
    const { useCase } = setup();

    const output = await useCase.execute({ creatorId: 7, name: "Rock" });

    expect(new Date(output.createdAt).toISOString()).toBe(output.createdAt);
  });

  it("normaliza nome e cor", async () => {
    const { useCase } = setup();

    const output = await useCase.execute({ creatorId: 7, name: "  Rock  ", color: "#ff8800" });

    expect(output.name).toBe("Rock");
    expect(output.color).toBe("#FF8800");
  });

  it.each([
    { name: "   " },
    { name: "a".repeat(151) },
    { name: "Rock", color: "azul" },
  ])("recusa %p e não salva nada", async (fields) => {
    const { repository, useCase } = setup();

    const error = await useCase.execute({ creatorId: 7, ...fields }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(repository.items).toHaveLength(0);
  });
});
