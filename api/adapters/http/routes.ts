import { Router } from "express";
import type { RequestHandler } from "express";
import type { PlaylistController } from "./playlist-controller.ts";
import { validateBody } from "./middlewares/validate-body.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";

export function makeRouter(playlists: PlaylistController, authenticate: RequestHandler): Router {
  const router = Router();

  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), playlists.create);

  return router;
}
