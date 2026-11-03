import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/domain-error.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { UpdatePlaylist } from "./update-playlist.ts";

const ANA = 1;
const BRUNO = 2;

async function setup() {
  const repository = new InMemoryPlaylistRepository();
  const playlist = Playlist.create({ id: await repository.nextId(), creatorId: ANA, name: "Rock", color: "#112233" });
  await repository.save(playlist);
  return { repository, playlistId: playlist.id, useCase: new UpdatePlaylist(repository) };
}

describe("UpdatePlaylist", () => {
  it("o admin renomeia, com o nome normalizado, e o resto não muda", async () => {
    const { repository, playlistId, useCase } = await setup();

    const output = await useCase.execute({ userId: ANA, playlistId, name: "  Rock nacional  " });

    expect(output).toMatchObject({ name: "Rock nacional", color: "#112233", isPrivate: false, isAdmin: true });
    expect((await repository.findById(playlistId))?.name).toBe("Rock nacional");
  });

  it("muda privacidade e cor, e color null apaga a cor", async () => {
    const { repository, playlistId, useCase } = await setup();

    await useCase.execute({ userId: ANA, playlistId, isPrivate: true, color: null });

    const saved = await repository.findById(playlistId);
    expect(saved?.isPrivate).toBe(true);
    expect(saved?.color).toBeNull();
  });

  it("recusa membro que não é admin com ForbiddenError e não salva nada", async () => {
    const { repository, playlistId, useCase } = await setup();
    const playlist = (await repository.findById(playlistId))!;
    playlist.addMember(BRUNO);
    await repository.save(playlist);
    const savesBefore = repository.saveCount;

    const error = await useCase.execute({ userId: BRUNO, playlistId, name: "Outro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(repository.saveCount).toBe(savesBefore);
    expect((await repository.findById(playlistId))?.name).toBe("Rock");
  });

  it("recusa quem não é membro de uma playlist pública com ForbiddenError", async () => {
    const { playlistId, useCase } = await setup();

    const error = await useCase.execute({ userId: BRUNO, playlistId, name: "Outro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("dá NotFoundError para playlist inexistente", async () => {
    const { useCase } = await setup();

    const error = await useCase.execute({ userId: ANA, playlistId: 999, name: "Outro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("deixa a entidade validar o nome e não salva nada", async () => {
    const { repository, playlistId, useCase } = await setup();
    const savesBefore = repository.saveCount;

    const error = await useCase.execute({ userId: ANA, playlistId, name: "   " }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(repository.saveCount).toBe(savesBefore);
  });
});
