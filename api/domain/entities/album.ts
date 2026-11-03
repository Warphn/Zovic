import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { addId, normalizeIds, removeId } from "../shared/ids.ts";
import { validateName } from "../shared/name.ts";

export interface ExistingAlbumData {
  id: number;
  name: string;
  artistIds: number[];
  genreIds: number[];
  musicIds: number[];
  createdAt: Date;
  deletedAt: Date | null;
}

export interface NewAlbumData {
  id: number;
  name: string;
  artistIds: number[];
  genreIds?: number[];
  musicIds?: number[];
  now?: Date;
}

/** Álbum com seus vínculos: album_artist, album_genre e album_music. */
export class Album {
  static readonly MAX_NAME_LENGTH = 255;

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
      musicIds: normalizeIds(input.musicIds ?? [], "Music"),
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

  get musicIds(): number[] {
    return [...this.input.musicIds];
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

  addMusic(musicId: number): void {
    this.ensureNotDeleted();
    this.input.musicIds = addId(this.input.musicIds, musicId, "Music");
  }

  removeMusic(musicId: number): void {
    this.ensureNotDeleted();
    this.input.musicIds = removeId(this.input.musicIds, musicId, "Music");
  }

  delete(now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.deletedAt = now;
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
    musicIds: [...data.musicIds],
  };
}
