import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { DeletePlaylist } from "./delete-playlist.ts";

const ANA = 1;
const BRUNO = 2;

async function setup() {
  const repository = new InMemoryPlaylistRepository();
  const playlist = Playlist.create({ id: await repository.nextId(), creatorId: ANA, name: "Rock" });
  playlist.addMember(BRUNO);
  await repository.save(playlist);
  return { repository, playlistId: playlist.id, useCase: new DeletePlaylist(repository) };
}

describe("DeletePlaylist", () => {
  it("o admin apaga, com soft delete", async () => {
    const { repository, playlistId, useCase } = await setup();
    const now = new Date("2026-11-03T12:00:00Z");

    await useCase.execute({ userId: ANA, playlistId, now });

    expect(await repository.findById(playlistId)).toBeNull();
    expect(repository.items[0]?.deletedAt).toEqual(now);
  });

  it("recusa membro que não é admin com ForbiddenError", async () => {
    const { repository, playlistId, useCase } = await setup();

    const error = await useCase.execute({ userId: BRUNO, playlistId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(await repository.findById(playlistId)).not.toBeNull();
  });

  it("apagar de novo dá NotFoundError", async () => {
    const { playlistId, useCase } = await setup();
    await useCase.execute({ userId: ANA, playlistId });

    const error = await useCase.execute({ userId: ANA, playlistId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
