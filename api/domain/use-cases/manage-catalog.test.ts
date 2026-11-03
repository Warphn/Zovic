import { beforeEach, describe, expect, it } from "bun:test";
import { Artist } from "../entities/artist.ts";
import { Genre } from "../entities/genre.ts";
import type { Music } from "../entities/music.ts";
import { BusinessRuleError, NotFoundError, ValidationError } from "../errors/domain-error.ts";
import type { ArtistRepository } from "../ports/artist-repository.ts";
import type { GenreRepository } from "../ports/genre-repository.ts";
import type { MusicRepository } from "../ports/music-repository.ts";
import { ManageCatalog } from "./manage-catalog.ts";

/** O erro com que a promessa rejeita; falha o teste se ela resolver. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

// Repositórios em memória com a mesma regra dos reais: findById só devolve registros ativos.
class InMemory<T extends { id: number; deletedAt: Date | null }> {
  readonly items = new Map<number, T>();
  private lastId = 0;

  async nextId(): Promise<number> {
    this.lastId += 1;
    return this.lastId;
  }

  async save(item: T): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: number): Promise<T | null> {
    const item = this.items.get(id);
    return item && !item.deletedAt ? item : null;
  }
}

class InMemoryMusics extends InMemory<Music> implements MusicRepository {
  async findByIds(ids: number[]): Promise<Music[]> {
    const found = await Promise.all(ids.map((id) => this.findById(id)));
    return found.filter((music) => music !== null);
  }
}
class InMemoryArtists extends InMemory<Artist> implements ArtistRepository {}
class InMemoryGenres extends InMemory<Genre> implements GenreRepository {}

let musics: InMemoryMusics;
let artists: InMemoryArtists;
let genres: InMemoryGenres;
let catalog: ManageCatalog;

beforeEach(async () => {
  musics = new InMemoryMusics();
  artists = new InMemoryArtists();
  genres = new InMemoryGenres();
  catalog = new ManageCatalog(musics, artists, genres);
  for (const name of ["Chico Buarque", "Elis Regina", "Tom Jobim"]) {
    await artists.save(Artist.create({ id: await artists.nextId(), name }));
  }
  await genres.save(Genre.create({ id: await genres.nextId(), name: "MPB", color: "#d33a2c" }));
  await genres.save(Genre.create({ id: await genres.nextId(), name: "Bossa", color: "#1e7f82" }));
});

describe("ManageCatalog: músicas", () => {
  it("cria a música com artistas e gêneros", async () => {
    const music = await catalog.createMusic({ name: "Construção", duration: 258, artistIds: [1], genreIds: [1] });

    expect(music).toMatchObject({ name: "Construção", duration: 258, artistIds: [1], genreIds: [1], deletedAt: null });
    expect(musics.items.size).toBe(1);
  });

  it("recusa artista ou gênero inexistente ou removido", async () => {
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [99] }))).toBeInstanceOf(NotFoundError);
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [1], genreIds: [99] }))).toBeInstanceOf(NotFoundError);

    await catalog.deleteArtist(2);
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [2] }))).toBeInstanceOf(NotFoundError);
  });

  it("recusa música sem artista", async () => {
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [] }))).toBeInstanceOf(ValidationError);
  });

  it("edita nome e duração e troca a lista inteira de artistas e gêneros", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1], genreIds: [1] });

    const updated = await catalog.updateMusic(id, { name: "Águas de Março", duration: 212, artistIds: [2, 3], genreIds: [2] });

    expect(updated).toMatchObject({ name: "Águas de Março", duration: 212, artistIds: [2, 3], genreIds: [2] });
  });

  it("deixa como está o que não veio na edição", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1, 2], genreIds: [1] });

    const updated = await catalog.updateMusic(id, { name: "Águas de Março" });

    expect(updated).toMatchObject({ name: "Águas de Março", duration: 200, artistIds: [1, 2], genreIds: [1] });
  });

  it("não deixa a edição tirar todos os artistas", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1] });

    expect(await rejection(catalog.updateMusic(id, { artistIds: [] }))).toBeInstanceOf(BusinessRuleError);
  });

  it("remove com soft delete; a removida não pode ser editada nem removida de novo", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1] });

    await catalog.deleteMusic(id);

    expect(musics.items.get(id)?.deletedAt).toBeInstanceOf(Date);
    expect(await rejection(catalog.updateMusic(id, { name: "Outra" }))).toBeInstanceOf(NotFoundError);
    expect(await rejection(catalog.deleteMusic(id))).toBeInstanceOf(NotFoundError);
  });
});

describe("ManageCatalog: artistas", () => {
  it("cria, renomeia e remove", async () => {
    const created = await catalog.createArtist("  Lô Borges ");
    expect(created.name).toBe("Lô Borges");

    expect((await catalog.renameArtist(created.id, "Lô Borges e Milton")).name).toBe("Lô Borges e Milton");

    await catalog.deleteArtist(created.id);
    expect(await rejection(catalog.renameArtist(created.id, "Outro"))).toBeInstanceOf(NotFoundError);
  });

  it("recusa nome em branco", async () => {
    expect(await rejection(catalog.createArtist("   "))).toBeInstanceOf(ValidationError);
  });
});
