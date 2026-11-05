import { ValidationError } from "../errors/domain-error.ts";

export interface CommentData {
  id: number;
  musicId: number;
  userId: number;
  comment: string;
  timestamp: number | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface NewCommentInput {
  id: number;
  musicId: number;
  userId: number;
  comment: string;
  timestamp?: number | null;
  musicDuration?: number | null;
  now?: Date;
}

export class Comment {
  static readonly MAX_LENGTH = 280;

  private constructor(private readonly data: CommentData) {}

  static create(input: NewCommentInput): Comment {
    const trimmed = Comment.validateComment(input.comment);
    const validTimestamp = Comment.validateTimestamp(input.timestamp, input.musicDuration);

    return new Comment({
      id: input.id,
      musicId: input.musicId,
      userId: input.userId,
      comment: trimmed,
      timestamp: validTimestamp,
      createdAt: input.now ?? new Date(),
      deletedAt: null,
    });
  }

  static restore(data: CommentData): Comment {
    return new Comment({ ...data });
  }

  get id(): number {
    return this.data.id;
  }

  get musicId(): number {
    return this.data.musicId;
  }

  get userId(): number {
    return this.data.userId;
  }

  get comment(): string {
    return this.data.comment;
  }

  get timestamp(): number | null {
    return this.data.timestamp;
  }

  get createdAt(): Date {
    return new Date(this.data.createdAt);
  }

  get deletedAt(): Date | null {
    return this.data.deletedAt ? new Date(this.data.deletedAt) : null;
  }

  get isDeleted(): boolean {
    return this.data.deletedAt !== null;
  }

  markAsDeleted(now = new Date()): void {
    if (this.data.deletedAt) {
      return;
    }
    this.data.deletedAt = now;
  }

  toData(): CommentData {
    return {
      ...this.data,
      createdAt: new Date(this.data.createdAt),
      deletedAt: this.data.deletedAt ? new Date(this.data.deletedAt) : null,
    };
  }

  private static validateComment(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Comment cannot be empty");
    }
    if (trimmed.length > Comment.MAX_LENGTH) {
      throw new ValidationError(`Comment cannot exceed ${Comment.MAX_LENGTH} characters`);
    }
    return trimmed;
  }

  private static validateTimestamp(
    timestamp?: number | null,
    musicDuration?: number | null,
  ): number | null {
    if (timestamp === undefined || timestamp === null) {
      return null;
    }
    if (!Number.isInteger(timestamp) || timestamp < 0) {
      throw new ValidationError("Timestamp must be a non-negative integer in seconds");
    }
    if (musicDuration !== undefined && musicDuration !== null && timestamp > musicDuration) {
      throw new ValidationError(`Timestamp (${timestamp}s) cannot exceed track duration (${musicDuration}s)`);
    }
    return timestamp;
  }
}

