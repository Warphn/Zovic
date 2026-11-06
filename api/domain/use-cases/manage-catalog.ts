import { Album } from "../entities/album.ts";
import { Artist } from "../entities/artist.ts";
import { Genre } from "../entities/genre.ts";
import { Music } from "../entities/music.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import { validateAudio } from "../shared/audio.ts";
import { validateCover } from "../shared/cover-image.ts";
import { normalizeIds } from "../shared/ids.ts";
import type { AlbumRepository } from "../ports/album-repository.ts";
import type { ArtistRepository } from "../ports/artist-repository.ts";
import type { FileStorage } from "../ports/file-storage.ts";
import type { GenreRepository } from "../ports/genre-repository.ts";
import type { MusicRepository } from "../ports/music-repository.ts";

/** Os áudios são sempre MP3 (validateAudio). */
const AUDIO_EXTENSION = ".mp3";

export interface CreateMusicInput {
  name: string;
  duration: number;
  artistIds: number[];
  genreIds?: number[];
  albumId?: number | null;
  isExplicit?: boolean;
}

/** Campos ausentes ficam como estão; artistIds e genreIds substituem a lista inteira. */
export interface UpdateMusicInput {
  name?: string;
  duration?: number;
  artistIds?: number[];
  genreIds?: number[];
  /** null tira a música do álbum. */
  albumId?: number | null;
  isExplicit?: boolean;
}

export interface CreateAlbumInput {
  name: string;
  artistIds: number[];
  year: number;
}

/** Campos ausentes ficam como estão; artistIds substitui a lista inteira. */
export type UpdateAlbumInput = Partial<CreateAlbumInput>;

export interface MusicOutput {
  id: number;
  name: string;
  duration: number;
  artistIds: number[];
  genreIds: number[];
  albumId: number | null;
  isExplicit: boolean;
  /** O nome do arquivo não sai da API: o player vai pedir o áudio por uma rota própria. */
  hasAudio: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export interface AlbumOutput {
  id: number;
  name: string;
  year: number | null;
  artistIds: number[];
  /** O nome do arquivo não sai da API: a capa é entregue por GET /api/albums/:id/cover. */
  hasCover: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export interface CreateGenreInput {
  name: string;
  /** Hex #RRGGBB. */
  color: string;
}

export interface GenreOutput {
  id: number;
  name: string;
  color: string;
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
    private readonly albums: AlbumRepository,
    private readonly audioStorage: FileStorage,
    private readonly coverStorage: FileStorage,
  ) {}

  /**
   * O arquivo só vai para o disco depois de conferidas as referências e o áudio; se a música
   * não chegar a ser salva, ele é apagado, para não sobrar áudio sem música.
   */
  async createMusic(input: CreateMusicInput, audio: Uint8Array | null): Promise<MusicOutput> {
    await this.ensureArtistsExist(input.artistIds);
    await this.ensureGenresExist(input.genreIds ?? []);
    const albumId = input.albumId ?? null;
    if (albumId !== null) await this.findAlbum(albumId);
    validateAudio(audio);

    const audioFile = await this.audioStorage.save(audio, AUDIO_EXTENSION);
    try {
      const music = Music.create({ id: await this.musics.nextId(), ...input, audioFile });
      await this.musics.save(music);
      return toMusicOutput(music);
    } catch (error) {
      await this.audioStorage.remove(audioFile);
      throw error;
    }
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
    if (input.albumId !== undefined) {
      if (input.albumId !== null) await this.findAlbum(input.albumId);
      music.changeAlbum(input.albumId);
    }
    if (input.isExplicit !== undefined) music.setExplicit(input.isExplicit);

    await this.musics.save(music);
    return toMusicOutput(music);
  }

  async deleteMusic(id: number): Promise<void> {
    const music = await this.findMusic(id);
    music.delete();
    await this.musics.save(music);
  }

  /** Como no cadastro de música: a capa só vai para o disco depois das conferências, e sai se o álbum não for salvo. */
  async createAlbum(input: CreateAlbumInput, cover: Uint8Array | null): Promise<AlbumOutput> {
    await this.ensureArtistsExist(input.artistIds);
    const extension = validateCover(cover);

    const coverFile = await this.coverStorage.save(cover!, extension);
    try {
      const album = Album.create({ id: await this.albums.nextId(), ...input, coverFile });
      await this.albums.save(album);
      return toAlbumOutput(album);
    } catch (error) {
      await this.coverStorage.remove(coverFile);
      throw error;
    }
  }

  /** A capa antiga só é apagada depois que o álbum foi salvo com a nova. */
  async changeAlbumCover(id: number, cover: Uint8Array | null): Promise<AlbumOutput> {
    const album = await this.findAlbum(id);
    const extension = validateCover(cover);
    const previousCover = album.coverFile;

    const coverFile = await this.coverStorage.save(cover!, extension);
    try {
      album.changeCover(coverFile);
      await this.albums.save(album);
    } catch (error) {
      await this.coverStorage.remove(coverFile);
      throw error;
    }
    if (previousCover !== null) await this.coverStorage.remove(previousCover);
    return toAlbumOutput(album);
  }

  async updateAlbum(id: number, input: UpdateAlbumInput): Promise<AlbumOutput> {
    const album = await this.findAlbum(id);
    if (input.name !== undefined) album.rename(input.name);
    if (input.year !== undefined) album.changeYear(input.year);
    if (input.artistIds !== undefined) {
      const wanted = normalizeIds(input.artistIds, "Artist");
      await this.ensureArtistsExist(wanted);
      // Acrescenta antes de tirar, para o álbum nunca ficar sem artista no meio da troca.
      for (const artistId of wanted.filter((a) => !album.artistIds.includes(a))) album.addArtist(artistId);
      for (const artistId of album.artistIds.filter((a) => !wanted.includes(a))) album.removeArtist(artistId);
    }
    await this.albums.save(album);
    return toAlbumOutput(album);
  }

  async deleteAlbum(id: number): Promise<void> {
    const album = await this.findAlbum(id);
    album.delete();
    await this.albums.save(album);
  }

  /** Um nome igual ao de outro gênero ativo vira BusinessRuleError no repositório. */
  async createGenre(input: CreateGenreInput): Promise<GenreOutput> {
    const genre = Genre.create({ id: await this.genres.nextId(), ...input });
    await this.genres.save(genre);
    return toGenreOutput(genre);
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

  private async findAlbum(id: number): Promise<Album> {
    const album = await this.albums.findById(id);
    if (!album) throw new NotFoundError("Album not found");
    return album;
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
    albumId: music.albumId,
    isExplicit: music.isExplicit,
    hasAudio: music.audioFile !== null,
    createdAt: music.createdAt.toISOString(),
    deletedAt: music.deletedAt?.toISOString() ?? null,
  };
}

function toAlbumOutput(album: Album): AlbumOutput {
  return {
    id: album.id,
    name: album.name,
    year: album.year,
    artistIds: album.artistIds,
    hasCover: album.coverFile !== null,
    createdAt: album.createdAt.toISOString(),
    deletedAt: album.deletedAt?.toISOString() ?? null,
  };
}

function toGenreOutput(genre: Genre): GenreOutput {
  return {
    id: genre.id,
    name: genre.name,
    color: genre.color,
    createdAt: genre.createdAt.toISOString(),
    deletedAt: genre.deletedAt?.toISOString() ?? null,
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
