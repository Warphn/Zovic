import type { RequestHandler } from "express";
import type { CreateCommentUseCase } from "../../domain/use-cases/create-comment.ts";
import type { DeleteCommentUseCase } from "../../domain/use-cases/delete-comment.ts";
import type { ListMusicCommentsUseCase } from "../../domain/use-cases/list-music-comments.ts";
import type { ReportCommentUseCase } from "../../domain/use-cases/report-comment.ts";

export interface CommentController {
  create: RequestHandler;
  listByMusic: RequestHandler;
  delete: RequestHandler;
  report: RequestHandler;
}

export function makeCommentController(
  createComment: CreateCommentUseCase,
  listComments: ListMusicCommentsUseCase,
  deleteComment: DeleteCommentUseCase,
  reportComment: ReportCommentUseCase,
): CommentController {
  return {
    create: async (req, res, next) => {
      try {
        const musicId = Number(req.params.musicId);
        const result = await createComment.execute({
          userId: res.locals.userId,
          musicId,
          comment: req.body.comment,
          timestamp: req.body.timestamp,
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },

    listByMusic: async (req, res, next) => {
      try {
        const musicId = Number(req.params.musicId);
        const result = await listComments.execute({
          viewerId: res.locals.userId,
          musicId,
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    delete: async (req, res, next) => {
      try {
        const commentId = Number(req.params.commentId);
        await deleteComment.execute({
          callerId: res.locals.userId,
          commentId,
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    report: async (req, res, next) => {
      try {
        const commentId = Number(req.params.commentId);
        const result = await reportComment.execute({
          reporterId: res.locals.userId,
          commentId,
          reason: req.body.reason,
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}

