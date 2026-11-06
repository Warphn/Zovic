import { CommentReport } from "../entities/comment-report.ts";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository } from "../ports/comment-repository.ts";
import type { UserRepository } from "../ports/user-repository.ts";
import { isUnderage } from "../shared/user-age.ts";

export interface ReportCommentInput {
  reporterId: number;
  commentId: number;
  reason: string;
}

export interface ReportCommentUseCase {
  execute(input: ReportCommentInput): Promise<{ success: true }>;
}

export class ReportComment implements ReportCommentUseCase {
  constructor(
    private readonly comments: CommentRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: ReportCommentInput): Promise<{ success: true }> {
    const reporter = await this.users.findById(input.reporterId);
    if (!reporter || reporter.deletedAt) {
      throw new NotFoundError("User not found");
    }

    if (isUnderage(reporter.birthdate)) {
      throw new ForbiddenError("Underage users cannot interact with comments");
    }

    const comment = await this.comments.findById(input.commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError("Comment not found");
    }

    if (comment.userId === input.reporterId) {
      throw new BusinessRuleError("You cannot report your own comment");
    }

    const alreadyReported = await this.comments.hasUserReported(input.commentId, input.reporterId);
    if (alreadyReported) {
      throw new BusinessRuleError("You have already reported this comment");
    }

    const id = await this.comments.nextReportId();
    const report = CommentReport.create({
      id,
      commentId: input.commentId,
      userId: input.reporterId,
      commentAuthorId: comment.userId,
      reason: input.reason,
    });

    await this.comments.saveReport(report);

    return { success: true };
  }
}

