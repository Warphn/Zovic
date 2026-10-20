import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";

export interface CommentReportData {
  id: number;
  commentId: number;
  userId: number;
  reason: string;
  createdAt: Date;
}

export interface NewCommentReportInput {
  id: number;
  commentId: number;
  userId: number;
  commentAuthorId?: number;
  reason: string;
  now?: Date;
}

export class CommentReport {
  static readonly MAX_REASON_LENGTH = 280;

  private constructor(private readonly data: CommentReportData) {}

  static create(input: NewCommentReportInput): CommentReport {
    if (input.commentAuthorId !== undefined && input.userId === input.commentAuthorId) {
      throw new BusinessRuleError("You cannot report your own comment");
    }

    const trimmed = input.reason.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Report reason cannot be empty");
    }
    if (trimmed.length > CommentReport.MAX_REASON_LENGTH) {
      throw new ValidationError(`Report reason cannot exceed ${CommentReport.MAX_REASON_LENGTH} characters`);
    }

    return new CommentReport({
      id: input.id,
      commentId: input.commentId,
      userId: input.userId,
      reason: trimmed,
      createdAt: input.now ?? new Date(),
    });
  }

  static restore(data: CommentReportData): CommentReport {
    return new CommentReport({ ...data });
  }

  get id(): number {
    return this.data.id;
  }

  get commentId(): number {
    return this.data.commentId;
  }

  get userId(): number {
    return this.data.userId;
  }

  get reason(): string {
    return this.data.reason;
  }

  get createdAt(): Date {
    return new Date(this.data.createdAt);
  }

  toData(): CommentReportData {
    return {
      ...this.data,
      createdAt: new Date(this.data.createdAt),
    };
  }
}

