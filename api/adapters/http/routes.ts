import { Router } from "express";
import type { RequestHandler } from "express";
import type { PlaylistController } from "./playlist-controller.ts";
import { validateBody, validateParams } from "./middlewares/validate-request.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";
import { playlistIdParamsSchema } from "./schemas/playlist-id-params-schema.ts";
import { updatePlaylistSchema } from "./schemas/update-playlist-schema.ts";

export function makeRouter(playlists: PlaylistController, authenticate: RequestHandler): Router {
  const router = Router();
  const playlistId = validateParams(playlistIdParamsSchema);

  router.get("/playlists", authenticate, playlists.list);
  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), playlists.create);
  router.get("/playlists/:id", authenticate, playlistId, playlists.get);
  router.patch("/playlists/:id", authenticate, playlistId, validateBody(updatePlaylistSchema), playlists.update);
  router.delete("/playlists/:id", authenticate, playlistId, playlists.remove);

  return router;
}
