import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Album } from "../../domain/entities/album.ts";
import { Artist } from "../../domain/entities/artist.ts";
import { Genre } from "../../domain/entities/genre.ts";
import { Music } from "../../domain/entities/music.ts";
import { BusinessRuleError, NotFoundError } from "../../domain/errors/domain-error.ts";
import { PostgresAlbumRepository } from "./postgres-album-repository.ts";
import { PostgresArtistRepository } from "./postgres-artist-repository.ts";
import { PostgresGenreRepository } from "./postgres-genre-repository.ts";
import { PostgresMusicRepository } from "./postgres-music-repository.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const genres = new PostgresGenreRepository(pool);
const artists = new PostgresArtistRepository(pool);
const albums = new PostgresAlbumRepository(pool);
const musics = new PostgresMusicRepository(pool);

const created = { genre: [] as number[], artist: [] as number[], album: [] as number[], musics: [] as number[] };
const MISSING_ID = 2_000_000_000;
// Nome único por execução: genre.name é único entre os ativos.
const suffix = Date.now().toString(36);
let artistId: number;
let otherArtistId: number;
let genreId: number;

async function newGenre(name: string): Promise<Genre> {
  const id = await genres.nextId();
  created.genre.push(id);
  return Genre.create({ id, name: `${name} ${suffix}`, color: "#ff8800" });
}

async function newArtist(name: string): Promise<Artist> {
  const id = await artists.nextId();
  created.artist.push(id);
  return Artist.create({ id, name });
}

async function newMusic(name: string, artistIds: number[], genreIds: number[] = []): Promise<Music> {
  const id = await musics.nextId();
  created.musics.push(id);
  return Music.create({ id, name, duration: 200, artistIds, genreIds });
}

async function newAlbum(artistIds: number[]): Promise<Album> {
  const id = await albums.nextId();
  created.album.push(id);
  return Album.create({ id, name: "Integration", artistIds });
}

beforeAll(async () => {
  const artist = await newArtist("Integration artist");
  const otherArtist = await newArtist("Integration artist 2");
  const genre = await newGenre("Integration genre");
  await artists.save(artist);
  await artists.save(otherArtist);
  await genres.save(genre);
  artistId = artist.id;
  otherArtistId = otherArtist.id;
  genreId = genre.id;
});

afterAll(async () => {
  // As associativas somem pelo ON DELETE CASCADE.
  for (const [table, ids] of Object.entries(created)) {
    await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::integer[])`, [ids]);
  }
  await pool.end();
});

describe("PostgresGenreRepository", () => {
  it("grava e lê de volta", async () => {
    const genre = await genres.findById(genreId);
    expect(genre?.name).toBe(`Integration genre ${suffix}`);
    expect(genre?.color).toBe("#FF8800");
  });

  it("traduz nome repetido em BusinessRuleError", async () => {
    const duplicate = await newGenre("Integration genre");
    const error = await genres.save(duplicate).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BusinessRuleError);
  });

  it("não encontra gênero apagado", async () => {
    const genre = await newGenre("Integration deleted");
    genre.delete();
    await genres.save(genre);
    expect(await genres.findById(genre.id)).toBeNull();
  });
});

describe("PostgresArtistRepository", () => {
  it("atualiza ao salvar de novo", async () => {
    const artist = await newArtist("Before");
    await artists.save(artist);
    artist.rename("After");
    await artists.save(artist);
    expect((await artists.findById(artist.id))?.name).toBe("After");
  });

  it("não encontra artista apagado", async () => {
    const artist = await newArtist("Integration deleted");
    artist.delete();
    await artists.save(artist);
    expect(await artists.findById(artist.id)).toBeNull();
  });
});

describe("PostgresMusicRepository", () => {
  it("grava a música com artistas e gêneros", async () => {
    const music = await newMusic("Integration", [artistId], [genreId]);
    await musics.save(music);

    const found = await musics.findById(music.id);
    expect(found?.toData()).toMatchObject({
      name: "Integration",
      duration: 200,
      streams: 0,
      rating: null,
      artistIds: [artistId],
      genreIds: [genreId],
    });
  });

  it("regrava os vínculos ao salvar de novo", async () => {
    const music = await newMusic("Integration", [artistId], [genreId]);
    await musics.save(music);

    music.addArtist(otherArtistId);
    music.removeArtist(artistId);
    music.removeGenre(genreId);
    await musics.save(music);

    const found = await musics.findById(music.id);
    expect(found?.artistIds).toEqual([otherArtistId]);
    expect(found?.genreIds).toEqual([]);
  });

  it("não sobrescreve as estatísticas ao salvar", async () => {
    const music = await newMusic("Integration", [artistId]);
    await musics.save(music);
    await pool.query("UPDATE musics SET streams = 10, rating = 4 WHERE id = $1", [music.id]);

    music.rename("Renamed");
    await musics.save(music);

    const found = await musics.findById(music.id);
    expect(found?.streams).toBe(10);
    expect(found?.rating).toBe(4);
  });

  it("findByIds devolve na ordem pedida e ignora inexistentes", async () => {
    const first = await newMusic("First", [artistId]);
    const second = await newMusic("Second", [artistId]);
    await musics.save(first);
    await musics.save(second);

    const found = await musics.findByIds([second.id, MISSING_ID, first.id]);
    expect(found.map((m) => m.id)).toEqual([second.id, first.id]);
  });

  it("não encontra música apagada, nem por findById nem por findByIds", async () => {
    const active = await newMusic("Active", [artistId]);
    const deleted = await newMusic("Deleted", [artistId]);
    deleted.delete();
    await musics.save(active);
    await musics.save(deleted);

    expect(await musics.findById(deleted.id)).toBeNull();
    const found = await musics.findByIds([deleted.id, active.id]);
    expect(found.map((m) => m.id)).toEqual([active.id]);
  });

  it("traduz artista inexistente em NotFoundError sem deixar música órfã", async () => {
    const music = await newMusic("Orphan", [MISSING_ID]);
    const error = await musics.save(music).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    const { rows } = await pool.query("SELECT 1 FROM musics WHERE id = $1", [music.id]);
    expect(rows).toHaveLength(0);
  });
});

describe("PostgresAlbumRepository", () => {
  it("grava o álbum com artistas, gêneros e músicas", async () => {
    const music = await newMusic("Track", [artistId]);
    await musics.save(music);
    const album = await newAlbum([artistId]);
    album.addGenre(genreId);
    album.addMusic(music.id);

    await albums.save(album);

    const found = await albums.findById(album.id);
    expect(found?.toData()).toMatchObject({ artistIds: [artistId], genreIds: [genreId], musicIds: [music.id] });
  });

  it("não encontra álbum apagado", async () => {
    const album = await newAlbum([artistId]);
    album.delete();
    await albums.save(album);
    expect(await albums.findById(album.id)).toBeNull();
  });

  it("traduz música inexistente em NotFoundError", async () => {
    const album = await newAlbum([artistId]);
    album.addMusic(MISSING_ID);
    const error = await albums.save(album).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});
