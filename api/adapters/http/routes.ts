import { Router } from "express";
import type { RequestHandler } from "express";
import type { AdminController, CatalogController } from "./admin-controller.ts";
import type { PlaylistController } from "./playlist-controller.ts";
import type { SearchController } from "./search-controller.ts";
import { requirePlatformAdmin } from "./middlewares/require-platform-admin.ts";
import { validateBody, validateParams, validateQuery } from "./middlewares/validate-request.ts";
import { artistSchema, createMusicSchema, createUserSchema, updateMusicSchema } from "./schemas/admin-schemas.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";
import { playlistIdParamsSchema, playlistMusicParamsSchema } from "./schemas/playlist-id-params-schema.ts";
import { addPlaylistMusicSchema, reorderPlaylistMusicsSchema } from "./schemas/playlist-musics-schemas.ts";
import { searchQuerySchema } from "./schemas/search-query-schema.ts";
import { updatePlaylistSchema } from "./schemas/update-playlist-schema.ts";

export interface Controllers {
  playlists: PlaylistController;
  search: SearchController;
  catalog: CatalogController;
  admin: AdminController;
}

export function makeRouter({ playlists, search, catalog, admin }: Controllers, authenticate: RequestHandler): Router {
  const router = Router();
  const playlistId = validateParams(playlistIdParamsSchema);

  router.get("/playlists", authenticate, playlists.list);
  router.post("/playlists", authenticate, validateBody(createPlaylistSchema), playlists.create);
  router.get("/playlists/:id", authenticate, playlistId, playlists.get);
  router.patch("/playlists/:id", authenticate, playlistId, validateBody(updatePlaylistSchema), playlists.update);
  router.delete("/playlists/:id", authenticate, playlistId, playlists.remove);

  router.get("/playlists/:id/musics", authenticate, playlistId, playlists.listMusics);
  router.post("/playlists/:id/musics", authenticate, playlistId, validateBody(addPlaylistMusicSchema), playlists.addMusic);
  router.put(
    "/playlists/:id/musics/order",
    authenticate,
    playlistId,
    validateBody(reorderPlaylistMusicsSchema),
    playlists.reorderMusics,
  );
  router.delete(
    "/playlists/:id/musics/:musicId",
    authenticate,
    validateParams(playlistMusicParamsSchema),
    playlists.removeMusic,
  );

  router.get("/search", authenticate, validateQuery(searchQuerySchema), search.search);

  router.get("/musics", authenticate, catalog.listMusics);
  router.post("/musics/:id/plays", authenticate, catalog.recordPlay);
  router.get("/artists", authenticate, catalog.listArtists);
  router.get("/genres", authenticate, catalog.listGenres);

  // Painel dos admins da plataforma: tudo em /api/admin passa pelos dois middlewares.
  const adminRouter = Router();
  adminRouter.get("/stats", admin.stats);
  adminRouter.get("/users", admin.listUsers);
  adminRouter.post("/users", validateBody(createUserSchema), admin.createUser);
  adminRouter.delete("/users/:id", admin.removeUser);
  adminRouter.get("/users/:id/plays", admin.recentPlays);
  adminRouter.post("/musics", validateBody(createMusicSchema), admin.createMusic);
  adminRouter.patch("/musics/:id", validateBody(updateMusicSchema), admin.updateMusic);
  adminRouter.delete("/musics/:id", admin.removeMusic);
  adminRouter.post("/artists", validateBody(artistSchema), admin.createArtist);
  adminRouter.patch("/artists/:id", validateBody(artistSchema), admin.renameArtist);
  adminRouter.delete("/artists/:id", admin.removeArtist);
  router.use("/admin", authenticate, requirePlatformAdmin, adminRouter);

  return router;
}
