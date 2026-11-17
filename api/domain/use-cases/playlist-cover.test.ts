import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "../errors/domain-error.ts";
import { InMemoryFileStorage } from "../testing/in-memory-file-storage.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { ChangePlaylistCover, GetPlaylistCover, RemovePlaylistCover } from "./playlist-cover.ts";

// HU-35: capa opcional da playlist; só o dono troca ou remove, e quem vê a playlist vê a capa.

const ANA = 1;
const BRUNO = 2;
const CARLA = 3;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

/** Uma playlist de Ana, com Bruno de colaborador. */
async function setup({ isPrivate = false } = {}) {
  const repository = new InMemoryPlaylistRepository();
  const covers = new InMemoryFileStorage();
  const playlist = Playlist.create({ id: await repository.nextId(), creatorId: ANA, name: "Rock", isPrivate });
  playlist.addMember(BRUNO);
  await repository.save(playlist);
  return {
    repository,
    covers,
    playlistId: playlist.id,
    change: new ChangePlaylistCover(repository, covers),
    remove: new RemovePlaylistCover(repository, covers),
    get: new GetPlaylistCover(repository),
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("Expected the promise to reject");
    },
    (error: unknown) => error,
  );
}

describe("ChangePlaylistCover", () => {
  it("o dono põe a capa, e a saída traz o endereço com a versão", async () => {
    const { repository, playlistId, change } = await setup();

    const output = await change.execute({ userId: ANA, playlistId, cover: PNG });

    expect(output.coverUrl).toBe(`/api/playlists/${playlistId}/cover?v=file-1`);
    expect((await repository.findById(playlistId))?.coverFile).toBe("file-1.png");
  });

  it("troca a capa e só então apaga a antiga", async () => {
    const { repository, covers, playlistId, change } = await setup();
    await change.execute({ userId: ANA, playlistId, cover: PNG });

    await change.execute({ userId: ANA, playlistId, cover: PNG });

    expect((await repository.findById(playlistId))?.coverFile).toBe("file-2.png");
    expect(covers.removed).toEqual(["file-1.png"]);
  });

  it("mantém a capa antiga e apaga a nova quando a playlist não é salva", async () => {
    const { repository, covers, playlistId, change } = await setup();
    await change.execute({ userId: ANA, playlistId, cover: PNG });
    const failure = new Error("banco fora do ar");
    repository.save = async () => {
      throw failure;
    };

    expect(await rejection(change.execute({ userId: ANA, playlistId, cover: PNG }))).toBe(failure);
    expect(covers.removed).toEqual(["file-2.png"]);
  });

  it("recusa o colaborador e quem não é membro com ForbiddenError, sem gravar nada", async () => {
    const { covers, playlistId, change } = await setup();

    expect(await rejection(change.execute({ userId: BRUNO, playlistId, cover: PNG }))).toBeInstanceOf(ForbiddenError);
    expect(await rejection(change.execute({ userId: CARLA, playlistId, cover: PNG }))).toBeInstanceOf(ForbiddenError);
    expect(covers.saved.size).toBe(0);
  });

  it("dá NotFoundError na playlist privada de outra pessoa", async () => {
    const { playlistId, change } = await setup({ isPrivate: true });

    expect(await rejection(change.execute({ userId: CARLA, playlistId, cover: PNG }))).toBeInstanceOf(NotFoundError);
  });

  it("recusa um arquivo que não é imagem, ou nenhum, e a capa não muda", async () => {
    const { repository, covers, playlistId, change } = await setup();

    expect(await rejection(change.execute({ userId: ANA, playlistId, cover: MP3 }))).toEqual(
      new ValidationError("Cover image must be a JPEG, PNG or WebP"),
    );
    expect(await rejection(change.execute({ userId: ANA, playlistId, cover: null }))).toEqual(
      new ValidationError("Playlist cover image is required"),
    );
    expect(covers.saved.size).toBe(0);
    expect((await repository.findById(playlistId))?.coverFile).toBeNull();
  });

  it("a Músicas Curtidas não aceita capa, e o arquivo gravado é apagado", async () => {
    const repository = new InMemoryPlaylistRepository();
    const covers = new InMemoryFileStorage();
    const likedSongs = await repository.createLikedSongs(Playlist.createLikedSongs({ id: await repository.nextId(), userId: ANA }));

    const error = await rejection(new ChangePlaylistCover(repository, covers).execute({ userId: ANA, playlistId: likedSongs.id, cover: PNG }));

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(covers.removed).toEqual(["file-1.png"]);
    expect((await repository.findById(likedSongs.id))?.coverFile).toBeNull();
  });
});

describe("RemovePlaylistCover", () => {
  it("o dono remove a capa, e o arquivo sai do armazenamento", async () => {
    const { repository, covers, playlistId, change, remove } = await setup();
    await change.execute({ userId: ANA, playlistId, cover: PNG });

    const output = await remove.execute({ userId: ANA, playlistId });

    expect(output.coverUrl).toBeNull();
    expect((await repository.findById(playlistId))?.coverFile).toBeNull();
    expect(covers.removed).toEqual(["file-1.png"]);
  });

  it("remover a capa de quem não tem não é erro e não apaga nada", async () => {
    const { covers, playlistId, remove } = await setup();

    expect((await remove.execute({ userId: ANA, playlistId })).coverUrl).toBeNull();
    expect(covers.removed).toEqual([]);
  });

  it("recusa o colaborador com ForbiddenError, e a capa fica", async () => {
    const { repository, playlistId, change, remove } = await setup();
    await change.execute({ userId: ANA, playlistId, cover: PNG });

    expect(await rejection(remove.execute({ userId: BRUNO, playlistId }))).toBeInstanceOf(ForbiddenError);
    expect((await repository.findById(playlistId))?.coverFile).toBe("file-1.png");
  });
});

describe("GetPlaylistCover", () => {
  it("o colaborador e qualquer assinante veem a capa da playlist pública", async () => {
    const { playlistId, change, get } = await setup();
    await change.execute({ userId: ANA, playlistId, cover: PNG });

    expect(await get.execute({ userId: BRUNO, playlistId })).toEqual({ coverFile: "file-1.png" });
    expect(await get.execute({ userId: CARLA, playlistId })).toEqual({ coverFile: "file-1.png" });
  });

  it("dá NotFoundError na capa da playlist privada de outra pessoa", async () => {
    const { playlistId, change, get } = await setup({ isPrivate: true });
    await change.execute({ userId: ANA, playlistId, cover: PNG });

    expect(await get.execute({ userId: BRUNO, playlistId })).toEqual({ coverFile: "file-1.png" });
    expect(await rejection(get.execute({ userId: CARLA, playlistId }))).toBeInstanceOf(NotFoundError);
  });

  it("dá NotFoundError na playlist sem capa", async () => {
    const { playlistId, get } = await setup();

    expect(await rejection(get.execute({ userId: ANA, playlistId }))).toEqual(new NotFoundError("Cover not found"));
  });
});
