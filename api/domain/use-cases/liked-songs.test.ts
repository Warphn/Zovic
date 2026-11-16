import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import { InMemoryPlaylistMusics } from "../testing/in-memory-playlist-musics.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { AddMusicToPlaylist } from "./add-music-to-playlist.ts";
import { EnsureLikedSongs, LikeMusic, UnlikeMusic } from "./liked-songs.ts";
import { ListMyPlaylists } from "./list-my-playlists.ts";
import { ReorderPlaylistMusics } from "./reorder-playlist-musics.ts";

// HU-34: a Músicas Curtidas de cada conta, alimentada pela curtida (a da HU-20 vai chamar estes casos de uso)

const ANA = 1;
const [ONDA, RESSACA, MARESIA, FORA_DO_CATALOGO] = [10, 11, 12, 99];

function setup() {
  const playlists = new InMemoryPlaylistRepository();
  const musics = new InMemoryPlaylistMusics();
  musics.catalog.set(ONDA, "Última Onda").set(RESSACA, "Ressaca").set(MARESIA, "Maresia");
  const ensure = new EnsureLikedSongs(playlists);
  return {
    playlists,
    musics,
    ensure,
    like: new LikeMusic(ensure, musics),
    unlike: new UnlikeMusic(playlists, musics),
  };
}

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);
const musicIds = (items: { id: number }[]) => items.map((item) => item.id);

describe("EnsureLikedSongs", () => {
  it("cria a Músicas Curtidas na primeira vez e devolve a mesma depois", async () => {
    const { ensure, playlists } = setup();

    const first = await ensure.execute({ userId: ANA });
    const second = await ensure.execute({ userId: ANA });

    expect(first.isLikedSongs).toBe(true);
    expect(second.id).toBe(first.id);
    expect(playlists.items).toHaveLength(1);
  });
});

describe("LikeMusic e UnlikeMusic", () => {
  it("curtir põe no topo, da mais recente para a mais antiga", async () => {
    const { like, ensure, musics } = setup();

    await like.execute({ userId: ANA, musicId: ONDA });
    await like.execute({ userId: ANA, musicId: RESSACA });
    await like.execute({ userId: ANA, musicId: MARESIA });

    const likedSongs = await ensure.execute({ userId: ANA });
    expect(musicIds(await musics.list(likedSongs.id))).toEqual([MARESIA, RESSACA, ONDA]);
  });

  it("curtir de novo não duplica nem muda a ordem", async () => {
    const { like, ensure, musics } = setup();
    await like.execute({ userId: ANA, musicId: ONDA });
    await like.execute({ userId: ANA, musicId: RESSACA });

    await like.execute({ userId: ANA, musicId: ONDA });

    const likedSongs = await ensure.execute({ userId: ANA });
    expect(musicIds(await musics.list(likedSongs.id))).toEqual([RESSACA, ONDA]);
  });

  it("curtir música fora do catálogo dá NotFoundError", async () => {
    const { like } = setup();

    expect(await failure(like.execute({ userId: ANA, musicId: FORA_DO_CATALOGO }))).toBeInstanceOf(NotFoundError);
  });

  it("descurtir tira a música; descurtir o que não está não dá erro", async () => {
    const { like, unlike, ensure, musics } = setup();
    await like.execute({ userId: ANA, musicId: ONDA });

    await unlike.execute({ userId: ANA, musicId: ONDA });
    await unlike.execute({ userId: ANA, musicId: RESSACA });

    const likedSongs = await ensure.execute({ userId: ANA });
    expect(await musics.list(likedSongs.id)).toEqual([]);
  });
});

describe("Músicas Curtidas nas outras telas", () => {
  it("ListMyPlaylists cria a Músicas Curtidas e a põe primeiro", async () => {
    const { playlists } = setup();
    const rock = Playlist.create({ id: await playlists.nextId(), creatorId: ANA, name: "Rock", now: new Date("2030-01-01") });
    await playlists.save(rock);

    const output = await new ListMyPlaylists(playlists).execute({ userId: ANA });

    expect(output.map((playlist) => [playlist.name, playlist.isLikedSongs])).toEqual([
      ["Músicas Curtidas", true],
      ["Rock", false],
    ]);
  });

  it("não deixa pôr música pelo menu nem reordenar a Músicas Curtidas", async () => {
    const { playlists, musics, like, ensure } = setup();
    await like.execute({ userId: ANA, musicId: ONDA });
    await like.execute({ userId: ANA, musicId: RESSACA });
    const likedSongs = await ensure.execute({ userId: ANA });

    const add = new AddMusicToPlaylist(playlists, musics);
    const reorder = new ReorderPlaylistMusics(playlists, musics);

    expect(await failure(add.execute({ userId: ANA, playlistId: likedSongs.id, musicId: MARESIA }))).toBeInstanceOf(
      BusinessRuleError,
    );
    expect(
      await failure(reorder.execute({ userId: ANA, playlistId: likedSongs.id, musicIds: [ONDA, RESSACA] })),
    ).toBeInstanceOf(BusinessRuleError);
  });
});
