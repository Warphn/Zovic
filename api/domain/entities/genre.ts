import { BusinessRuleError } from "../errors/domain-error.ts";
import { normalizeHexColor } from "../shared/hex-color.ts";
import { validateName } from "../shared/name.ts";

export interface ExistingGenreData {
  id: number;
  name: string;
  color: string;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface NewGenreData {
  id: number;
  name: string;
  color: string;
  now?: Date;
}

export class Genre {
  static readonly MAX_NAME_LENGTH = 100;

  private constructor(private readonly input: ExistingGenreData) {}

  static create(input: NewGenreData): Genre {
    return new Genre({
      id: input.id,
      name: validateName(input.name, Genre.MAX_NAME_LENGTH, "Genre"),
      color: normalizeHexColor(input.color),
      createdAt: input.now ?? new Date(),
      deletedAt: null,
    });
  }

  static restore(input: ExistingGenreData): Genre {
    return new Genre({ ...input });
  }

  get id(): number {
    return this.input.id;
  }

  get name(): string {
    return this.input.name;
  }

  get color(): string {
    return this.input.color;
  }

  get createdAt(): Date {
    return new Date(this.input.createdAt);
  }

  get deletedAt(): Date | null {
    return this.input.deletedAt ? new Date(this.input.deletedAt) : null;
  }

  toData(): ExistingGenreData {
    return { ...this.input };
  }

  rename(name: string): void {
    this.ensureNotDeleted();
    this.input.name = validateName(name, Genre.MAX_NAME_LENGTH, "Genre");
  }

  changeColor(color: string): void {
    this.ensureNotDeleted();
    this.input.color = normalizeHexColor(color);
  }

  delete(now: Date = new Date()): void {
    this.ensureNotDeleted();
    this.input.deletedAt = now;
  }

  private ensureNotDeleted(): void {
    if (this.input.deletedAt !== null) {
      throw new BusinessRuleError("This genre has been deleted");
    }
  }
}
