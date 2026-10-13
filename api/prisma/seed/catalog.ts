/**
 * Catálogo (LOCAL): artistas, álbuns e músicas, com seus gêneros.
 *
 * Toda música e todo álbum saem com ao menos um artista. `streams` recebe um
 * número fixo por música; `rating` é calculado depois, pelas Interações.
 */
import { ALBUMS, ARTISTS, SINGLES, type Release, type Track } from "./catalog-data.ts";
import { byName, day, idOf, random, type Seeder } from "./support.ts";

export const seedCatalog: Seeder["run"] = async (tx) => {
  const rnd = random(7);
  const genreIds = byName(await tx.genre.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true }
  }));
  const artists = await tx.artist.createManyAndReturn({
    data: ARTISTS.map((name, i) => ({ name, createdAt: day(-90 + i) })),
    select: { id: true, name: true },
  });
  const artistIds = byName(artists);

  let musics = 0;
  const createMusic = (track: Track & Release, albumId?: number) => {
    musics++;
    return tx.music.create({
      data: {
        name: track.name,
        duration: track.seconds,
        streams: rnd.int(0, 50_000),
        createdAt: day(-60 + musics),
        artists: { create: [...track.artists, ...(track.feat ?? [])].map((name) => ({ artistId: idOf(artistIds, name) })) },
        genres: { create: track.genres.map((name) => ({ genreId: idOf(genreIds, name) })) },
        ...(albumId ? { albums: { create: { albumId } } } : {}),
      },
    });
  };

  for (const [i, album] of ALBUMS.entries()) {
    const { id } = await tx.album.create({
      data: {
        name: album.name,
        createdAt: day(-80 + i),
        artists: { create: album.artists.map((name) => ({ artistId: idOf(artistIds, name) })) },
        genres: { create: album.genres.map((name) => ({ genreId: idOf(genreIds, name) })) },
      },
    });
    for (const track of album.tracks) {
      await createMusic({ ...track, artists: album.artists, genres: album.genres }, id);
    }
  }
  for (const single of SINGLES) await createMusic(single);

  return `${ARTISTS.length} artistas, ${ALBUMS.length} álbuns, ${musics} músicas (${SINGLES.length} fora de álbum)`;
};
