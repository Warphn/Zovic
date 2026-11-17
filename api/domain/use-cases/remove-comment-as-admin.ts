import { NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository } from "../ports/comment-repository.ts";

// Moderação (HU-23): o admin remove qualquer comentário, e o banco guarda quem removeu. Quem é admin
// é decidido antes, pela rota (/api/admin passa pelo requirePlatformAdmin).

export interface RemoveCommentAsAdminInput {
  adminId: number;
  commentId: number;
}

export interface RemoveCommentAsAdminUseCase {
  execute(input: RemoveCommentAsAdminInput): Promise<void>;
}

export class RemoveCommentAsAdmin implements RemoveCommentAsAdminUseCase {
  constructor(private readonly comments: CommentRepository) {}

  async execute({ adminId, commentId }: RemoveCommentAsAdminInput): Promise<void> {
    const comment = await this.comments.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError("Comment not found");
    }
    await this.comments.softDelete(commentId, adminId);
  }
}
