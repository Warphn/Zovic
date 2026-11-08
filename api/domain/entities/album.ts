import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { addId, normalizeIds, removeId } from "../shared/ids.ts";
import { validateName } from "../shared/name.ts";

export interface ExistingAlbumData {
  id: number;
  name: string;
  artistIds: number[];
  genreIds: number[];
  /** Ano de lançamento; null só nos álbuns anteriores à coluna. */
  year: number | null;
  /** Nome da imagem de capa no armazenamento (FileStorage); null só nos álbuns anteriores à capa. */
  coverFile: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface NewAlbumData {
  id: number;
  name: string;
  artistIds: number[];
  genreIds?: number[];
  year: number;
  coverFile: string;
  now?: Date;
}

/**
 * Álbum com seus vínculos: album_artist e album_genre. As faixas (album_music) são
 * da música: cada uma diz o próprio álbum (Music.albumId).
 */
export class Album {
  static readonly MAX_NAME_LENGTH = 255;
  static readonly MIN_YEAR = 1900;

  private constructor(private readonly input: ExistingAlbumData) {}

  static create(input: NewAlbumData): Album {
    const artistIds = normalizeIds(input.artistIds, "Artist");
    if (artistIds.length === 0) {
      throw new ValidationError("Album must have at least one artist");
    }
    return new Album({
      id: input.id,
      name: validateName(input.name, Album.MAX_NAME_LENGTH, "Album"),
      artistIds,
      genreIds: normalizeIds(input.genreIds ?? [], "Genre"),
      year: Album.validateYear(input.year, input.now ?? new Date()),
      coverFile: Album.validateCoverFile(input.coverFile),
      createdAt: input.now ?? new Date(),
      deletedAt: null,
    });
  }

  static restore(input: ExistingAlbumData): Album {
    return new Album(copy(input));
  }

  get id(): number {
    return this.input.id;
  }

  get name(): string {
    return this.input.name;
  }

  get artistIds(): number[] {
    return [...this.input.artistIds];
  }

  get genreIds(): number[] {
    return [...this.input.genreIds];
  }

  get year(): number | null {
    return this.input.year;
  }

  get coverFile(): string | null {
    return this.input.coverFile;
  }

  get createdAt(): Date {
    return new Date(this.input.createdAt);
  }

  get deletedAt(): Date | null {
    return this.input.deletedAt ? new Date(this.input.deletedAt) : null;
  }

  toData(): ExistingAlbumData {
    return copy(this.input);
  }

  rename(name: string): void {
    this.ensureNotDeleted();
    this.input.name = validateName(name, Album.MAX_NAME_LENGTH, "Album");
  }

  addArtist(artistId: number): void {
    this.ensureNotDeleted();
    this.input.artistIds = addId(this.input.artistIds, artistId, "Artist");
  }

  removeArtist(artistId: number): void {
    this.ensureNotDeleted();
    const artistIds = removeId(this.input.artistIds, artistId, "Artist");
    if (artistIds.length === 0) {
      throw new BusinessRuleError("Album must have at least one artist");
    }
    this.input.artistIds = artistIds;
  }

  addGenre(genreId: number): void {
    this.ensureNotDeleted();
    this.input.genreIds = addId(this.input.genreIds, genreId, "Genre");
  }

  removeGenre(genreId: number): void {
    this.ensureNotDeleted();
    this.input.genreIds = removeId(this.input.genreIds, genreId, "Genre");
  }

  changeYear(year: number, now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.year = Album.validateYear(year, now);
  }

  changeCover(coverFile: string): void {
    this.ensureNotDeleted();
    this.input.coverFile = Album.validateCoverFile(coverFile);
  }

  delete(now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.deletedAt = now;
  }

  private static validateCoverFile(coverFile: string): string {
    if (coverFile.trim() === "") {
      throw new ValidationError("Album must have a cover image");
    }
    return coverFile;
  }

  /** O limite superior muda com o tempo, por isso fica aqui e não num CHECK do banco. */
  private static validateYear(year: number, now: Date): number {
    const currentYear = now.getFullYear();
    if (!Number.isInteger(year) || year < Album.MIN_YEAR || year > currentYear) {
      throw new ValidationError(`Album year must be between ${Album.MIN_YEAR} and ${currentYear}`);
    }
    return year;
  }

  private ensureNotDeleted(): void {
    if (this.input.deletedAt !== null) {
      throw new BusinessRuleError("This album has been deleted");
    }
  }
}

function copy(data: ExistingAlbumData): ExistingAlbumData {
  return {
    ...data,
    artistIds: [...data.artistIds],
    genreIds: [...data.genreIds],
  };
}
