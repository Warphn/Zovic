import { Router } from "express";
import type { RequestHandler } from "express";
import type { PlaylistController } from "./playlist-controller.ts";
import type { SearchController } from "./search-controller.ts";
import { validateBody, validateParams, validateQuery } from "./middlewares/validate-request.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";
import { playlistIdParamsSchema } from "./schemas/playlist-id-params-schema.ts";
import { searchQuerySchema } from "./schemas/search-query-schema.ts";
import { updatePlaylistSchema } from "./schemas/update-playlist-schema.ts";

export interface Controllers {
  playlists: PlaylistController;
  search: SearchController;
}

export function makeRouter({ playlists, search }: Controllers, authenticate: RequestHandler): Router {
  const router = Router();
  const playlistId = validateParams(playlistIdParamsSchema);

  router.get("/playlists", authenticate, playlists.list);
  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), playlists.create);
  router.get("/playlists/:id", authenticate, playlistId, playlists.get);
  router.patch("/playlists/:id", authenticate, playlistId, validateBody(updatePlaylistSchema), playlists.update);
  router.delete("/playlists/:id", authenticate, playlistId, playlists.remove);

  router.get("/search", authenticate, validateQuery(searchQuerySchema), search.search);

  return router;
}
