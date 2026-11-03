import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import { InMemoryPlaylistMusics } from "../testing/in-memory-playlist-musics.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { AddMusicToPlaylist } from "./add-music-to-playlist.ts";
import { ListPlaylistMusics } from "./list-playlist-musics.ts";
import { RemoveMusicFromPlaylist } from "./remove-music-from-playlist.ts";
import { ReorderPlaylistMusics } from "./reorder-playlist-musics.ts";

// Casos de uso das músicas de uma playlist. As regras de SQL (ordem, soft delete, álbum) estão
// no teste de integração do gateway; aqui ficam permissão, erros e o que cada caso devolve.

const ANA = 1;
const BRUNO = 2;
const CARLA = 3;
const [ONDA, RESSACA, MARESIA, FORA_DO_CATALOGO] = [10, 11, 12, 99];

async function setup({ isPrivate = false } = {}) {
  const playlists = new InMemoryPlaylistRepository();
  const musics = new InMemoryPlaylistMusics();
  musics.catalog.set(ONDA, "Última Onda").set(RESSACA, "Ressaca").set(MARESIA, "Maresia");

  // Ana é admin; Bruno é membro sem ser admin; Carla não é membro.
  const playlist = Playlist.create({ id: await playlists.nextId(), creatorId: ANA, name: "Mar", isPrivate });
  playlist.addMember(BRUNO);
  await playlists.save(playlist);
  await musics.add(playlist.id, ONDA, new Date("2026-11-01T10:00:00Z"));
  await musics.add(playlist.id, RESSACA, new Date("2026-11-02T10:00:00Z"));

  return {
    musics,
    playlistId: playlist.id,
    list: new ListPlaylistMusics(playlists, musics),
    add: new AddMusicToPlaylist(playlists, musics),
    remove: new RemoveMusicFromPlaylist(playlists, musics),
    reorder: new ReorderPlaylistMusics(playlists, musics),
  };
}

const ids = (items: { id: number }[]) => items.map((item) => item.id);
const failure = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

describe("ListPlaylistMusics", () => {
  it("lista as músicas na ordem da playlist para qualquer um que a veja", async () => {
    const { list, playlistId } = await setup();

    const comoCarla = await list.execute({ userId: CARLA, playlistId });

    expect(ids(comoCarla)).toEqual([ONDA, RESSACA]);
  });

  it("esconde as músicas da playlist privada de quem não é membro com NotFoundError", async () => {
    const { list, playlistId } = await setup({ isPrivate: true });

    expect(ids(await list.execute({ userId: BRUNO, playlistId }))).toEqual([ONDA, RESSACA]);
    expect(await failure(list.execute({ userId: CARLA, playlistId }))).toBeInstanceOf(NotFoundError);
  });

  it("dá NotFoundError para playlist inexistente", async () => {
    const { list } = await setup();

    expect(await failure(list.execute({ userId: ANA, playlistId: 999 }))).toBeInstanceOf(NotFoundError);
  });
});

describe("AddMusicToPlaylist", () => {
  it("põe a música no fim e devolve a lista atualizada", async () => {
    const { add, playlistId } = await setup();

    const output = await add.execute({ userId: ANA, playlistId, musicId: MARESIA });

    expect(ids(output)).toEqual([ONDA, RESSACA, MARESIA]);
  });

  it("recusa quem não é admin: 403 para quem vê a playlist, 404 na privada de outra pessoa", async () => {
    const publica = await setup();
    const privada = await setup({ isPrivate: true });

    expect(await failure(publica.add.execute({ userId: BRUNO, playlistId: publica.playlistId, musicId: MARESIA }))).toBeInstanceOf(
      ForbiddenError,
    );
    expect(await failure(publica.add.execute({ userId: CARLA, playlistId: publica.playlistId, musicId: MARESIA }))).toBeInstanceOf(
      ForbiddenError,
    );
    expect(await failure(privada.add.execute({ userId: CARLA, playlistId: privada.playlistId, musicId: MARESIA }))).toBeInstanceOf(
      NotFoundError,
    );
    expect(ids(await publica.musics.list(publica.playlistId))).toEqual([ONDA, RESSACA]);
  });

  it("dá NotFoundError para música fora do catálogo e BusinessRuleError para música repetida", async () => {
    const { add, playlistId } = await setup();

    expect(await failure(add.execute({ userId: ANA, playlistId, musicId: FORA_DO_CATALOGO }))).toBeInstanceOf(NotFoundError);
    expect(await failure(add.execute({ userId: ANA, playlistId, musicId: ONDA }))).toBeInstanceOf(BusinessRuleError);
  });
});

describe("RemoveMusicFromPlaylist", () => {
  it("tira a música da playlist", async () => {
    const { remove, musics, playlistId } = await setup();

    await remove.execute({ userId: ANA, playlistId, musicId: ONDA });

    expect(ids(await musics.list(playlistId))).toEqual([RESSACA]);
  });

  it("dá NotFoundError para música que não está na playlist e ForbiddenError para quem não é admin", async () => {
    const { remove, playlistId } = await setup();

    expect(await failure(remove.execute({ userId: ANA, playlistId, musicId: MARESIA }))).toBeInstanceOf(NotFoundError);
    expect(await failure(remove.execute({ userId: BRUNO, playlistId, musicId: ONDA }))).toBeInstanceOf(ForbiddenError);
  });
});

describe("ReorderPlaylistMusics", () => {
  it("grava a ordem nova e devolve a lista nela", async () => {
    const { reorder, add, playlistId } = await setup();
    await add.execute({ userId: ANA, playlistId, musicId: MARESIA });

    const output = await reorder.execute({ userId: ANA, playlistId, musicIds: [MARESIA, ONDA, RESSACA] });

    expect(ids(output)).toEqual([MARESIA, ONDA, RESSACA]);
  });

  it("recusa com BusinessRuleError a lista que não tem exatamente as músicas da playlist", async () => {
    const { reorder, musics, playlistId } = await setup();

    for (const musicIds of [[RESSACA], [RESSACA, ONDA, MARESIA], [RESSACA, ONDA, ONDA], [RESSACA, MARESIA]]) {
      expect(await failure(reorder.execute({ userId: ANA, playlistId, musicIds }))).toBeInstanceOf(BusinessRuleError);
    }
    expect(ids(await musics.list(playlistId))).toEqual([ONDA, RESSACA]);
  });

  it("recusa quem não é admin com ForbiddenError", async () => {
    const { reorder, playlistId } = await setup();

    expect(await failure(reorder.execute({ userId: BRUNO, playlistId, musicIds: [RESSACA, ONDA] }))).toBeInstanceOf(ForbiddenError);
  });
});
