import { Artist } from "../entities/artist.ts";
import { Music } from "../entities/music.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import { normalizeIds } from "../shared/ids.ts";
import type { ArtistRepository } from "../ports/artist-repository.ts";
import type { GenreRepository } from "../ports/genre-repository.ts";
import type { MusicRepository } from "../ports/music-repository.ts";

export interface CreateMusicInput {
  name: string;
  duration: number;
  artistIds: number[];
  genreIds?: number[];
}

/** Campos ausentes ficam como estão; artistIds e genreIds substituem a lista inteira. */
export interface UpdateMusicInput {
  name?: string;
  duration?: number;
  artistIds?: number[];
  genreIds?: number[];
}

export interface MusicOutput {
  id: number;
  name: string;
  duration: number;
  artistIds: number[];
  genreIds: number[];
  createdAt: string;
  deletedAt: string | null;
}

export interface ArtistOutput {
  id: number;
  name: string;
  createdAt: string;
  deletedAt: string | null;
}

/**
 * Gestão do catálogo pelo painel de admin. Remover é sempre soft delete: o histórico
 * (reproduções, playlists, avaliações) continua apontando para o registro.
 */
export class ManageCatalog {
  constructor(
    private readonly musics: MusicRepository,
    private readonly artists: ArtistRepository,
    private readonly genres: GenreRepository,
  ) {}

  async createMusic(input: CreateMusicInput): Promise<MusicOutput> {
    await this.ensureArtistsExist(input.artistIds);
    await this.ensureGenresExist(input.genreIds ?? []);
    // Provisório: o upload do áudio entra no próximo passo do plano (Tarefa 5).
    const music = Music.create({ id: await this.musics.nextId(), ...input, audioFile: "pendente.mp3" });
    await this.musics.save(music);
    return toMusicOutput(music);
  }

  async updateMusic(id: number, input: UpdateMusicInput): Promise<MusicOutput> {
    const music = await this.findMusic(id);
    if (input.name !== undefined) music.rename(input.name);
    if (input.duration !== undefined) music.changeDuration(input.duration);

    if (input.artistIds !== undefined) {
      const wanted = normalizeIds(input.artistIds, "Artist");
      await this.ensureArtistsExist(wanted);
      // Acrescenta antes de tirar, para a música nunca ficar sem artista no meio da troca.
      for (const artistId of wanted.filter((a) => !music.artistIds.includes(a))) music.addArtist(artistId);
      for (const artistId of music.artistIds.filter((a) => !wanted.includes(a))) music.removeArtist(artistId);
    }
    if (input.genreIds !== undefined) {
      const wanted = normalizeIds(input.genreIds, "Genre");
      await this.ensureGenresExist(wanted);
      for (const genreId of wanted.filter((g) => !music.genreIds.includes(g))) music.addGenre(genreId);
      for (const genreId of music.genreIds.filter((g) => !wanted.includes(g))) music.removeGenre(genreId);
    }

    await this.musics.save(music);
    return toMusicOutput(music);
  }

  async deleteMusic(id: number): Promise<void> {
    const music = await this.findMusic(id);
    music.delete();
    await this.musics.save(music);
  }

  async createArtist(name: string): Promise<ArtistOutput> {
    const artist = Artist.create({ id: await this.artists.nextId(), name });
    await this.artists.save(artist);
    return toArtistOutput(artist);
  }

  async renameArtist(id: number, name: string): Promise<ArtistOutput> {
    const artist = await this.findArtist(id);
    artist.rename(name);
    await this.artists.save(artist);
    return toArtistOutput(artist);
  }

  async deleteArtist(id: number): Promise<void> {
    const artist = await this.findArtist(id);
    artist.delete();
    await this.artists.save(artist);
  }

  private async findMusic(id: number): Promise<Music> {
    const music = await this.musics.findById(id);
    if (!music) throw new NotFoundError("Music not found");
    return music;
  }

  private async findArtist(id: number): Promise<Artist> {
    const artist = await this.artists.findById(id);
    if (!artist) throw new NotFoundError("Artist not found");
    return artist;
  }

  // O banco aceitaria um artista ou gênero com soft delete (a linha existe); o domínio não.
  private async ensureArtistsExist(ids: number[]): Promise<void> {
    for (const id of normalizeIds(ids, "Artist")) {
      if (!(await this.artists.findById(id))) throw new NotFoundError(`Artist ${id} not found`);
    }
  }

  private async ensureGenresExist(ids: number[]): Promise<void> {
    for (const id of normalizeIds(ids, "Genre")) {
      if (!(await this.genres.findById(id))) throw new NotFoundError(`Genre ${id} not found`);
    }
  }
}

function toMusicOutput(music: Music): MusicOutput {
  return {
    id: music.id,
    name: music.name,
    duration: music.duration,
    artistIds: music.artistIds,
    genreIds: music.genreIds,
    createdAt: music.createdAt.toISOString(),
    deletedAt: music.deletedAt?.toISOString() ?? null,
  };
}

function toArtistOutput(artist: Artist): ArtistOutput {
  return {
    id: artist.id,
    name: artist.name,
    createdAt: artist.createdAt.toISOString(),
    deletedAt: artist.deletedAt?.toISOString() ?? null,
  };
}
