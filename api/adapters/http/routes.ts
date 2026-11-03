import { Router } from "express";
import type { RequestHandler } from "express";
import type { CommentController } from "./comment-controller.ts";
import type { PlaylistController } from "./playlist-controller.ts";
import { validateBody } from "./middlewares/validate-body.ts";
import { createCommentSchema } from "./schemas/create-comment-schema.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";
import { reportCommentSchema } from "./schemas/report-comment-schema.ts";

export interface Controllers {
  playlists: PlaylistController;
  comments: CommentController;
}

export function makeRouter(controllers: Controllers, authenticate: RequestHandler): Router {
  const router = Router();

  // Playlists
  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), controllers.playlists.create);

  // Comentários
  router.get("/musics/:musicId/comments", authenticate, controllers.comments.listByMusic);
  router.post("/musics/:musicId/comments", authenticate, validateBody(createCommentSchema), controllers.comments.create);
  router.delete("/comments/:commentId", authenticate, controllers.comments.delete);
  router.post("/comments/:commentId/reports", authenticate, validateBody(reportCommentSchema), controllers.comments.report);

  return router;
}
