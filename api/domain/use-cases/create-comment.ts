import { Comment } from "../entities/comment.ts";
import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository } from "../ports/comment-repository.ts";
import type { UserRepository } from "../ports/user-repository.ts";
import { isUnderage } from "../shared/user-age.ts";

export interface CreateCommentInput {
  userId: number;
  musicId: number;
  comment: string;
  timestamp?: number | null;
}

export interface CreateCommentOutput {
  id: number;
  musicId: number;
  userId: number;
  comment: string;
  timestamp: number | null;
  createdAt: string;
}

export interface CreateCommentUseCase {
  execute(input: CreateCommentInput): Promise<CreateCommentOutput>;
}

export class CreateComment implements CreateCommentUseCase {
  constructor(
    private readonly comments: CommentRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: CreateCommentInput): Promise<CreateCommentOutput> {
    const user = await this.users.findById(input.userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    if (isUnderage(user.birthdate)) {
      throw new ForbiddenError("Underage users cannot comment");
    }

    const musicDuration = await this.comments.getMusicDuration(input.musicId);
    const id = await this.comments.nextId();

    const comment = Comment.create({
      id,
      musicId: input.musicId,
      userId: input.userId,
      comment: input.comment,
      timestamp: input.timestamp,
      musicDuration,
    });

    await this.comments.save(comment);

    return {
      id: comment.id,
      musicId: comment.musicId,
      userId: comment.userId,
      comment: comment.comment,
      timestamp: comment.timestamp,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}

