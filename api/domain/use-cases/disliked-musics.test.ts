import { describe, expect, it } from "bun:test";
import { NotFoundError } from "../errors/domain-error.ts";
import { InMemoryMusicDislikes } from "../testing/in-memory-music-dislikes.ts";
import { InMemoryPlaylistMusics } from "../testing/in-memory-playlist-musics.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { DislikeMusic, ListMyDislikedMusics, RemoveDislike } from "./disliked-musics.ts";
import { EnsureLikedSongs, LikeMusic, UnlikeMusic } from "./liked-songs.ts";

// HU-20: o dislike, com um voto por conta e música (o dislike tira o like, e o like tira o dislike)

const [ANA, BRUNO] = [1, 2];
const [ONDA, RESSACA, FORA_DO_CATALOGO, PROIBIDAO] = [10, 11, 99, 13];
const NOW = new Date("2026-11-17T15:00:00Z");
const adult = { birthdate: "1995-03-12", now: NOW };
const minor = { birthdate: "2010-01-01", now: NOW };

function setup() {
  const playlists = new InMemoryPlaylistRepository();
  const musics = new InMemoryPlaylistMusics();
  const dislikes = new InMemoryMusicDislikes();
  musics.catalog.set(ONDA, "Última Onda").set(RESSACA, "Ressaca").set(PROIBIDAO, "Proibidão");
  musics.explicitIds.add(PROIBIDAO);
  for (const musicId of [ONDA, RESSACA, PROIBIDAO]) dislikes.catalogIds.add(musicId);
  dislikes.explicitIds.add(PROIBIDAO);
  const ensure = new EnsureLikedSongs(playlists);
  const unlike = new UnlikeMusic(playlists, musics);
  return {
    dislikes,
    likedMusicIds: async (userId: number) => {
      const likedSongs = await ensure.execute({ userId });
      return (await musics.list(likedSongs.id, true)).map((music) => music.id);
    },
    like: new LikeMusic(ensure, musics, dislikes),
    dislike: new DislikeMusic(dislikes, unlike),
    removeDislike: new RemoveDislike(dislikes),
    listDisliked: new ListMyDislikedMusics(dislikes),
  };
}

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

describe("DislikeMusic, RemoveDislike e ListMyDislikedMusics", () => {
  it("lista as músicas com dislike da conta, da mais recente para a mais antiga", async () => {
    const { dislike, listDisliked } = setup();

    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });
    await dislike.execute({ userId: ANA, musicId: RESSACA, ...adult });
    await dislike.execute({ userId: BRUNO, musicId: ONDA, ...adult });

    expect(await listDisliked.execute({ userId: ANA })).toEqual([RESSACA, ONDA]);
    expect(await listDisliked.execute({ userId: BRUNO })).toEqual([ONDA]);
  });

  it("dar dislike de novo não duplica", async () => {
    const { dislike, listDisliked } = setup();

    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });
    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });

    expect(await listDisliked.execute({ userId: ANA })).toEqual([ONDA]);
  });

  it("dar dislike em música fora do catálogo dá NotFoundError", async () => {
    const { dislike } = setup();

    expect(await failure(dislike.execute({ userId: ANA, musicId: FORA_DO_CATALOGO, ...adult }))).toBeInstanceOf(NotFoundError);
  });

  it("tirar o dislike tira a música da lista; tirar o que não existe não dá erro", async () => {
    const { dislike, removeDislike, listDisliked } = setup();
    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });

    await removeDislike.execute({ userId: ANA, musicId: ONDA });
    await removeDislike.execute({ userId: ANA, musicId: RESSACA });

    expect(await listDisliked.execute({ userId: ANA })).toEqual([]);
  });
});

describe("um voto por conta e música", () => {
  it("o dislike numa música com like tira a música da Músicas Curtidas", async () => {
    const { like, dislike, likedMusicIds } = setup();
    await like.execute({ userId: ANA, musicId: ONDA, ...adult });
    await like.execute({ userId: ANA, musicId: RESSACA, ...adult });

    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });

    expect(await likedMusicIds(ANA)).toEqual([RESSACA]);
  });

  it("o like numa música com dislike tira o dislike", async () => {
    const { like, dislike, listDisliked, likedMusicIds } = setup();
    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });

    await like.execute({ userId: ANA, musicId: ONDA, ...adult });

    expect(await listDisliked.execute({ userId: ANA })).toEqual([]);
    expect(await likedMusicIds(ANA)).toEqual([ONDA]);
  });

  it("o voto de uma conta não mexe no da outra", async () => {
    const { like, dislike, listDisliked, likedMusicIds } = setup();
    await like.execute({ userId: BRUNO, musicId: ONDA, ...adult });

    await dislike.execute({ userId: ANA, musicId: ONDA, ...adult });

    expect(await likedMusicIds(BRUNO)).toEqual([ONDA]);
    expect(await listDisliked.execute({ userId: BRUNO })).toEqual([]);
  });
});

describe("dislike de música explícita (HU-09)", () => {
  it("menor de idade e quem não tem data de nascimento recebem NotFoundError", async () => {
    const { dislike, listDisliked } = setup();

    expect(await failure(dislike.execute({ userId: ANA, musicId: PROIBIDAO, ...minor }))).toBeInstanceOf(NotFoundError);
    expect(await failure(dislike.execute({ userId: ANA, musicId: PROIBIDAO, birthdate: null, now: NOW }))).toBeInstanceOf(
      NotFoundError,
    );
    expect(await listDisliked.execute({ userId: ANA })).toEqual([]);
  });

  it("maior de idade e admin da plataforma dão dislike na explícita", async () => {
    for (const viewer of [adult, { birthdate: null, now: NOW, isAdmin: true }]) {
      const { dislike, listDisliked } = setup();

      await dislike.execute({ userId: ANA, musicId: PROIBIDAO, ...viewer });

      expect(await listDisliked.execute({ userId: ANA })).toEqual([PROIBIDAO]);
    }
  });
});
