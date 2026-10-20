import { ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository } from "../ports/comment-repository.ts";
import type { UserRepository } from "../ports/user-repository.ts";

export interface DeleteCommentInput {
  callerId: number;
  commentId: number;
}

export interface DeleteCommentUseCase {
  execute(input: DeleteCommentInput): Promise<{ success: true }>;
}

export class DeleteComment implements DeleteCommentUseCase {
  constructor(
    private readonly comments: CommentRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: DeleteCommentInput): Promise<{ success: true }> {
    const caller = await this.users.findById(input.callerId);
    if (!caller || caller.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const comment = await this.comments.findById(input.commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError("Comment not found");
    }

    if (comment.userId !== input.callerId) {
      throw new ForbiddenError("You can only delete your own comments");
    }

    await this.comments.softDelete(input.commentId);

    return { success: true };
  }
}

