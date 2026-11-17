import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { validateName } from "../shared/name.ts";

export interface ExistingArtistData {
  id: number;
  name: string;
  createdAt: Date;
  deletedAt: Date | null;
  /** Nome da foto no armazenamento (FileStorage); nula ou ausente no artista sem foto (HU-36). */
  imageFile?: string | null;
}

export interface NewArtistData {
  id: number;
  name: string;
  now?: Date;
}

export class Artist {
  static readonly MAX_NAME_LENGTH = 255;

  private constructor(private readonly input: ExistingArtistData) {}

  static create(input: NewArtistData): Artist {
    return new Artist({
      id: input.id,
      name: validateName(input.name, Artist.MAX_NAME_LENGTH, "Artist"),
      createdAt: input.now ?? new Date(),
      deletedAt: null,
    });
  }

  static restore(input: ExistingArtistData): Artist {
    return new Artist({ ...input });
  }

  get id(): number {
    return this.input.id;
  }

  get name(): string {
    return this.input.name;
  }

  get createdAt(): Date {
    return new Date(this.input.createdAt);
  }

  get deletedAt(): Date | null {
    return this.input.deletedAt ? new Date(this.input.deletedAt) : null;
  }

  get imageFile(): string | null {
    return this.input.imageFile ?? null;
  }

  toData(): ExistingArtistData {
    return { ...this.input };
  }

  rename(name: string): void {
    this.ensureNotDeleted();
    this.input.name = validateName(name, Artist.MAX_NAME_LENGTH, "Artist");
  }

  changeImage(imageFile: string): void {
    this.ensureNotDeleted();
    if (imageFile.trim() === "") {
      throw new ValidationError("Artist image file cannot be empty");
    }
    this.input.imageFile = imageFile;
  }

  removeImage(): void {
    this.ensureNotDeleted();
    this.input.imageFile = null;
  }

  delete(now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.deletedAt = now;
  }

  private ensureNotDeleted(): void {
    if (this.input.deletedAt !== null) {
      throw new BusinessRuleError("This artist has been deleted");
    }
  }
}
