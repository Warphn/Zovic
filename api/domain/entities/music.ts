import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { addId, normalizeIds, removeId } from "../shared/ids.ts";
import { validateName } from "../shared/name.ts";

export interface ExistingMusicData {
  id: number;
  name: string;
  /** Segundos. */
  duration: number;
  lyricsId: number | null;
  streams: number;
  /** Média das avaliações; null enquanto não houver nenhuma. */
  rating: number | null;
  artistIds: number[];
  genreIds: number[];
  createdAt: Date;
  deletedAt: Date | null;
}

export interface NewMusicData {
  id: number;
  name: string;
  duration: number;
  artistIds: number[];
  genreIds?: number[];
  lyricsId?: number | null;
  now?: Date;
}

/**
 * Música com seus vínculos: artist_music e genre_music.
 *
 * `streams` e `rating` são estatísticas calculadas fora da entidade: ela só as
 * expõe, e o repositório não as sobrescreve ao salvar.
 */
export class Music {
  static readonly MAX_NAME_LENGTH = 255;

  private constructor(private readonly input: ExistingMusicData) {}

  static create(input: NewMusicData): Music {
    const artistIds = normalizeIds(input.artistIds, "Artist");
    if (artistIds.length === 0) {
      throw new ValidationError("Music must have at least one artist");
    }
    return new Music({
      id: input.id,
      name: validateName(input.name, Music.MAX_NAME_LENGTH, "Music"),
      duration: Music.validateDuration(input.duration),
      lyricsId: Music.validateLyricsId(input.lyricsId ?? null),
      streams: 0,
      rating: null,
      artistIds,
      genreIds: normalizeIds(input.genreIds ?? [], "Genre"),
      createdAt: input.now ?? new Date(),
      deletedAt: null,
    });
  }

  static restore(input: ExistingMusicData): Music {
    return new Music(copy(input));
  }

  get id(): number {
    return this.input.id;
  }

  get name(): string {
    return this.input.name;
  }

  get duration(): number {
    return this.input.duration;
  }

  get lyricsId(): number | null {
    return this.input.lyricsId;
  }

  get streams(): number {
    return this.input.streams;
  }

  get rating(): number | null {
    return this.input.rating;
  }

  get artistIds(): number[] {
    return [...this.input.artistIds];
  }

  get genreIds(): number[] {
    return [...this.input.genreIds];
  }

  get createdAt(): Date {
    return new Date(this.input.createdAt);
  }

  get deletedAt(): Date | null {
    return this.input.deletedAt ? new Date(this.input.deletedAt) : null;
  }

  toData(): ExistingMusicData {
    return copy(this.input);
  }

  rename(name: string): void {
    this.ensureNotDeleted();
    this.input.name = validateName(name, Music.MAX_NAME_LENGTH, "Music");
  }

  changeDuration(duration: number): void {
    this.ensureNotDeleted();
    this.input.duration = Music.validateDuration(duration);
  }

  addArtist(artistId: number): void {
    this.ensureNotDeleted();
    this.input.artistIds = addId(this.input.artistIds, artistId, "Artist");
  }

  removeArtist(artistId: number): void {
    this.ensureNotDeleted();
    const artistIds = removeId(this.input.artistIds, artistId, "Artist");
    if (artistIds.length === 0) {
      throw new BusinessRuleError("Music must have at least one artist");
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

  delete(now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.deletedAt = now;
  }

  private static validateDuration(duration: number): number {
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new ValidationError("Music duration must be a positive number of seconds");
    }
    return duration;
  }

  private static validateLyricsId(lyricsId: number | null): number | null {
    if (lyricsId !== null && (!Number.isInteger(lyricsId) || lyricsId <= 0)) {
      throw new ValidationError("Lyrics id must be a positive integer");
    }
    return lyricsId;
  }

  private ensureNotDeleted(): void {
    if (this.input.deletedAt !== null) {
      throw new BusinessRuleError("This music has been deleted");
    }
  }
}

function copy(data: ExistingMusicData): ExistingMusicData {
  return { ...data, artistIds: [...data.artistIds], genreIds: [...data.genreIds] };
}
