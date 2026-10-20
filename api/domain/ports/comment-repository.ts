import type { Comment } from "../entities/comment.ts";
import type { CommentReport } from "../entities/comment-report.ts";

export interface CommentWithAuthor {
  id: number;
  musicId: number;
  userId: number;
  authorName: string;
  authorBirthdate: Date | null;
  comment: string;
  timestamp: number | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CommentRepository {
  nextId(): Promise<number>;
  nextReportId(): Promise<number>;
  save(comment: Comment): Promise<void>;
  findById(id: number): Promise<Comment | null>;
  listActiveByMusicId(musicId: number): Promise<CommentWithAuthor[]>;
  softDelete(id: number, deletedAt?: Date): Promise<void>;
  saveReport(report: CommentReport): Promise<void>;
  hasUserReported(commentId: number, userId: number): Promise<boolean>;
  getMusicDuration(musicId: number): Promise<number | null>;
}

