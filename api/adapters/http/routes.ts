import { Router } from "express";
import { authenticate } from "./middlewares/authenticate.ts";
import { validateBody } from "./middlewares/validate-body.ts";
import type { PlaylistController } from "./playlist-controller.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";

export function makeRouter(playlists: PlaylistController): Router {
  const router = Router();

  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), playlists.create);

  return router;
}
