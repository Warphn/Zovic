import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { GetPlaylist } from "./get-playlist.ts";

const ANA = 1;
const BRUNO = 2;

async function setup(isPrivate: boolean) {
  const repository = new InMemoryPlaylistRepository();
  const playlist = Playlist.create({ id: await repository.nextId(), creatorId: ANA, name: "Rock", isPrivate });
  await repository.save(playlist);
  return { repository, playlist, useCase: new GetPlaylist(repository) };
}

describe("GetPlaylist", () => {
  it("devolve a playlist ao admin", async () => {
    const { playlist, useCase } = await setup(true);

    const output = await useCase.execute({ userId: ANA, playlistId: playlist.id });

    expect(output).toMatchObject({ id: playlist.id, name: "Rock", isPrivate: true, isAdmin: true });
  });

  it("mostra a playlist pública de outra pessoa, sem papel de admin", async () => {
    const { playlist, useCase } = await setup(false);

    const output = await useCase.execute({ userId: BRUNO, playlistId: playlist.id });

    expect(output).toMatchObject({ id: playlist.id, isAdmin: false });
  });

  it("mostra a playlist privada a um membro que não é admin", async () => {
    const { repository, playlist, useCase } = await setup(true);
    playlist.addMember(BRUNO);
    await repository.save(playlist);

    const output = await useCase.execute({ userId: BRUNO, playlistId: playlist.id });

    expect(output.isAdmin).toBe(false);
  });

  it("esconde a playlist privada de quem não é membro com NotFoundError", async () => {
    const { playlist, useCase } = await setup(true);

    const error = await useCase.execute({ userId: BRUNO, playlistId: playlist.id }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("dá NotFoundError para id inexistente e para playlist apagada", async () => {
    const { repository, playlist, useCase } = await setup(false);
    playlist.delete();
    await repository.save(playlist);

    const inexistente = await useCase.execute({ userId: ANA, playlistId: 999 }).catch((e: unknown) => e);
    const apagada = await useCase.execute({ userId: ANA, playlistId: playlist.id }).catch((e: unknown) => e);

    expect(inexistente).toBeInstanceOf(NotFoundError);
    expect(apagada).toBeInstanceOf(NotFoundError);
  });
});
