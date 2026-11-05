import { beforeEach, describe, expect, it } from "bun:test";
import { Album } from "../entities/album.ts";
import { Artist } from "../entities/artist.ts";
import { Genre } from "../entities/genre.ts";
import { Music } from "../entities/music.ts";
import { BusinessRuleError, NotFoundError, ValidationError } from "../errors/domain-error.ts";
import type { AlbumRepository } from "../ports/album-repository.ts";
import type { ArtistRepository } from "../ports/artist-repository.ts";
import type { FileStorage } from "../ports/file-storage.ts";
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
class InMemoryAlbums extends InMemory<Album> implements AlbumRepository {}

/** Guarda em memória o que foi gravado e o que foi removido, sem tocar no disco. */
class FakeFileStorage implements FileStorage {
  readonly saved = new Map<string, Uint8Array>();
  readonly removed: string[] = [];

  async save(bytes: Uint8Array, extension: string): Promise<string> {
    const fileName = `file-${this.saved.size + 1}${extension}`;
    this.saved.set(fileName, bytes);
    return fileName;
  }

  async remove(fileName: string): Promise<void> {
    this.removed.push(fileName);
  }
}

/** Um MP3 mínimo para o domínio: só a tag ID3 do começo importa. */
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

let musics: InMemoryMusics;
let artists: InMemoryArtists;
let genres: InMemoryGenres;
let albums: InMemoryAlbums;
let audioStorage: FakeFileStorage;
let catalog: ManageCatalog;

beforeEach(async () => {
  musics = new InMemoryMusics();
  artists = new InMemoryArtists();
  genres = new InMemoryGenres();
  albums = new InMemoryAlbums();
  audioStorage = new FakeFileStorage();
  catalog = new ManageCatalog(musics, artists, genres, albums, audioStorage);
  for (const name of ["Chico Buarque", "Elis Regina", "Tom Jobim"]) {
    await artists.save(Artist.create({ id: await artists.nextId(), name }));
  }
  await genres.save(Genre.create({ id: await genres.nextId(), name: "MPB", color: "#d33a2c" }));
  await genres.save(Genre.create({ id: await genres.nextId(), name: "Bossa", color: "#1e7f82" }));
  await albums.save(Album.create({ id: await albums.nextId(), name: "Construção", artistIds: [1], year: 1971 }));
});

describe("ManageCatalog: músicas", () => {
  it("cria a música com artistas e gêneros", async () => {
    const music = await catalog.createMusic({ name: "Construção", duration: 258, artistIds: [1], genreIds: [1] }, MP3);

    expect(music).toMatchObject({ name: "Construção", duration: 258, artistIds: [1], genreIds: [1], deletedAt: null });
    expect(musics.items.size).toBe(1);
  });

  it("recusa artista ou gênero inexistente ou removido", async () => {
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [99] }, MP3))).toBeInstanceOf(NotFoundError);
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [1], genreIds: [99] }, MP3))).toBeInstanceOf(NotFoundError);

    await catalog.deleteArtist(2);
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [2] }, MP3))).toBeInstanceOf(NotFoundError);
  });

  it("recusa música sem artista", async () => {
    expect(await rejection(catalog.createMusic({ name: "X", duration: 10, artistIds: [] }, MP3))).toBeInstanceOf(ValidationError);
  });

  it("edita nome e duração e troca a lista inteira de artistas e gêneros", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1], genreIds: [1] }, MP3);

    const updated = await catalog.updateMusic(id, { name: "Águas de Março", duration: 212, artistIds: [2, 3], genreIds: [2] });

    expect(updated).toMatchObject({ name: "Águas de Março", duration: 212, artistIds: [2, 3], genreIds: [2] });
  });

  it("deixa como está o que não veio na edição", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1, 2], genreIds: [1] }, MP3);

    const updated = await catalog.updateMusic(id, { name: "Águas de Março" });

    expect(updated).toMatchObject({ name: "Águas de Março", duration: 200, artistIds: [1, 2], genreIds: [1] });
  });

  it("não deixa a edição tirar todos os artistas", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1] }, MP3);

    expect(await rejection(catalog.updateMusic(id, { artistIds: [] }))).toBeInstanceOf(BusinessRuleError);
  });

  it("remove com soft delete; a removida não pode ser editada nem removida de novo", async () => {
    const { id } = await catalog.createMusic({ name: "Águas", duration: 200, artistIds: [1] }, MP3);

    await catalog.deleteMusic(id);

    expect(musics.items.get(id)?.deletedAt).toBeInstanceOf(Date);
    expect(await rejection(catalog.updateMusic(id, { name: "Outra" }))).toBeInstanceOf(NotFoundError);
    expect(await rejection(catalog.deleteMusic(id))).toBeInstanceOf(NotFoundError);
  });
});

describe("ManageCatalog: áudio, álbum e explícito", () => {
  it("grava o áudio e cria a música com álbum e marca de explícito", async () => {
    const music = await catalog.createMusic({ name: "Cotidiano", duration: 170, artistIds: [1], albumId: 1, isExplicit: true }, MP3);

    expect(music).toMatchObject({ albumId: 1, isExplicit: true, hasAudio: true });
    expect([...audioStorage.saved.keys()]).toEqual(["file-1.mp3"]);
    expect(musics.items.get(music.id)?.audioFile).toBe("file-1.mp3");
  });

  it("não cria a música sem áudio e não grava nada", async () => {
    const error = await rejection(catalog.createMusic({ name: "Muda", duration: 10, artistIds: [1] }, null));

    expect(error).toEqual(new ValidationError("Music must have an audio file"));
    expect(audioStorage.saved.size).toBe(0);
    expect(musics.items.size).toBe(0);
  });

  it("recusa um arquivo que não é MP3 antes de gravar", async () => {
    const error = await rejection(catalog.createMusic({ name: "Imagem", duration: 10, artistIds: [1] }, PNG));

    expect(error).toEqual(new ValidationError("Audio file must be an MP3"));
    expect(audioStorage.saved.size).toBe(0);
  });

  it("recusa um álbum removido sem gravar o áudio", async () => {
    await catalog.deleteAlbum(1);

    const error = await rejection(catalog.createMusic({ name: "Órfã", duration: 10, artistIds: [1], albumId: 1 }, MP3));

    expect(error).toEqual(new NotFoundError("Album not found"));
    expect(audioStorage.saved.size).toBe(0);
  });

  it("apaga o arquivo gravado quando a música não é salva", async () => {
    const failure = new Error("banco fora do ar");
    musics.save = async () => {
      throw failure;
    };

    expect(await rejection(catalog.createMusic({ name: "Perdida", duration: 10, artistIds: [1] }, MP3))).toBe(failure);
    expect(audioStorage.removed).toEqual(["file-1.mp3"]);
  });

  it("edita uma música antiga, sem áudio, sem exigir arquivo", async () => {
    const legacy = Music.restore({
      ...Music.create({ id: 50, name: "Antiga", duration: 100, artistIds: [1], audioFile: "x.mp3" }).toData(),
      audioFile: null,
    });
    await musics.save(legacy);

    const updated = await catalog.updateMusic(50, { name: "Antiga remasterizada" });

    expect(updated).toMatchObject({ name: "Antiga remasterizada", hasAudio: false });
  });

  it("tira o álbum e marca o explícito na edição", async () => {
    const { id } = await catalog.createMusic({ name: "Cálice", duration: 240, artistIds: [1], albumId: 1 }, MP3);

    const updated = await catalog.updateMusic(id, { albumId: null, isExplicit: true });

    expect(updated).toMatchObject({ albumId: null, isExplicit: true });
  });

  it("recusa trocar para um álbum inexistente", async () => {
    const { id } = await catalog.createMusic({ name: "Cálice", duration: 240, artistIds: [1] }, MP3);

    expect(await rejection(catalog.updateMusic(id, { albumId: 99 }))).toEqual(new NotFoundError("Album not found"));
  });
});

describe("ManageCatalog: álbuns", () => {
  it("cria, edita nome, ano e artistas, e remove", async () => {
    const created = await catalog.createAlbum({ name: "Clube da Esquina", artistIds: [1], year: 1972 });
    expect(created).toMatchObject({ name: "Clube da Esquina", artistIds: [1], year: 1972, deletedAt: null });

    const updated = await catalog.updateAlbum(created.id, { name: "Clube da Esquina 2", year: 1978, artistIds: [2, 3] });
    expect(updated).toMatchObject({ name: "Clube da Esquina 2", year: 1978, artistIds: [2, 3] });

    await catalog.deleteAlbum(created.id);
    expect(await rejection(catalog.updateAlbum(created.id, { year: 1980 }))).toEqual(new NotFoundError("Album not found"));
  });

  it("recusa artista inexistente e ano fora do intervalo", async () => {
    expect(await rejection(catalog.createAlbum({ name: "X", artistIds: [99], year: 2000 }))).toBeInstanceOf(NotFoundError);
    expect(await rejection(catalog.createAlbum({ name: "X", artistIds: [1], year: 1899 }))).toBeInstanceOf(ValidationError);
  });
});

describe("ManageCatalog: gêneros", () => {
  it("cria o gênero com a cor normalizada", async () => {
    const created = await catalog.createGenre({ name: "  Forró ", color: "#e8a33d" });

    expect(created).toMatchObject({ name: "Forró", color: "#E8A33D", deletedAt: null });
    expect(genres.items.has(created.id)).toBe(true);
  });

  it("recusa nome em branco e cor fora do formato", async () => {
    expect(await rejection(catalog.createGenre({ name: "  ", color: "#e8a33d" }))).toBeInstanceOf(ValidationError);
    expect(await rejection(catalog.createGenre({ name: "Forró", color: "laranja" }))).toBeInstanceOf(ValidationError);
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
