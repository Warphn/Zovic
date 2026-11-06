import { Router } from "express";
import type { RequestHandler } from "express";
import type { AdminController, CatalogController } from "./admin-controller.ts";
import type { CommentController } from "./comment-controller.ts";
import type { HistoryController } from "./history-controller.ts";
import type { PlaylistController } from "./playlist-controller.ts";
import type { SearchController } from "./search-controller.ts";
import type { SubscriptionController } from "./subscription-controller.ts";
import { validateInvitationToken } from "./middlewares/validate-invitation-token.ts";
import { requirePlatformAdmin } from "./middlewares/require-platform-admin.ts";
import { receiveAudio, receiveCover } from "./middlewares/file-upload.ts";
import { validateBody, validateMultipartData, validateParams, validateQuery } from "./middlewares/validate-request.ts";
import {
  artistSchema,
  createAlbumSchema,
  createMusicSchema,
  createUserSchema,
  genreSchema,
  updateAlbumSchema,
  updateMusicSchema,
} from "./schemas/admin-schemas.ts";
import { createCommentSchema } from "./schemas/create-comment-schema.ts";
import { createPlaylistSchema } from "./schemas/create-playlist-schema.ts";
import { playlistIdParamsSchema, playlistMusicParamsSchema } from "./schemas/playlist-id-params-schema.ts";
import { addPlaylistMusicSchema, reorderPlaylistMusicsSchema } from "./schemas/playlist-musics-schemas.ts";
import { reportCommentSchema } from "./schemas/report-comment-schema.ts";
import { searchQuerySchema } from "./schemas/search-query-schema.ts";
import {
  inviteSchema,
  invitationIdParamsSchema,
  memberIdParamsSchema,
  subscribeSchema,
} from "./schemas/subscription-schemas.ts";
import { updatePlaylistSchema } from "./schemas/update-playlist-schema.ts";

export interface Controllers {
  playlists: PlaylistController;
  search: SearchController;
  catalog: CatalogController;
  admin: AdminController;
  comments: CommentController;
  subscriptions: SubscriptionController;
  history: HistoryController;
}

export function makeRouter(
  { playlists, search, catalog, admin, comments, subscriptions, history }: Controllers,
  authenticate: RequestHandler,
  requireSubscription: RequestHandler,
): Router {
  const router = Router();
  const subscriberOnly = [authenticate, requireSubscription];

  router.post("/plans", authenticate, validateBody(subscribeSchema), subscriptions.subscribe);
  router.get("/plans/me", authenticate, subscriptions.getMine);
  router.delete("/plans/me", authenticate, subscriptions.cancel);

  // Plano familiar: gestor convida e remove, membro sai. Nenhuma passa por requireSubscription.
  router.get("/plans/me/members", authenticate, subscriptions.listMembers);
  router.post("/plans/me/invitations", authenticate, validateBody(inviteSchema), subscriptions.invite);
  router.delete(
    "/plans/me/invitations/:id",
    authenticate,
    validateParams(invitationIdParamsSchema),
    subscriptions.cancelInvitation,
  );
  router.delete(
    "/plans/me/members/:userId",
    authenticate,
    validateParams(memberIdParamsSchema),
    subscriptions.removeMember,
  );
  router.delete("/plans/me/membership", authenticate, subscriptions.leave);

  // A consulta do convite é pública: quem ainda não tem conta precisa vê-lo antes de se cadastrar.
  router.get("/invitations/:token", validateInvitationToken, subscriptions.getInvitation);
  router.post("/invitations/:token/accept", authenticate, validateInvitationToken, subscriptions.acceptInvitation);

  const playlistId = validateParams(playlistIdParamsSchema);

  router.get("/playlists", subscriberOnly, playlists.list);
  router.post("/playlists", subscriberOnly, validateBody(createPlaylistSchema), playlists.create);
  router.get("/playlists/:id", subscriberOnly, playlistId, playlists.get);
  router.patch("/playlists/:id", subscriberOnly, playlistId, validateBody(updatePlaylistSchema), playlists.update);
  router.delete("/playlists/:id", subscriberOnly, playlistId, playlists.remove);

  router.get("/playlists/:id/musics", subscriberOnly, playlistId, playlists.listMusics);
  router.post("/playlists/:id/musics", subscriberOnly, playlistId, validateBody(addPlaylistMusicSchema), playlists.addMusic);
  router.put(
    "/playlists/:id/musics/order",
    subscriberOnly,
    playlistId,
    validateBody(reorderPlaylistMusicsSchema),
    playlists.reorderMusics,
  );
  router.delete(
    "/playlists/:id/musics/:musicId",
    subscriberOnly,
    validateParams(playlistMusicParamsSchema),
    playlists.removeMusic,
  );

  router.get("/history", subscriberOnly, history.list);

  router.get("/search", subscriberOnly, validateQuery(searchQuerySchema), search.search);

  router.get("/musics", subscriberOnly, catalog.listMusics);
  router.post("/musics/:id/plays", subscriberOnly, catalog.recordPlay);
  router.get("/musics/:id/audio", subscriberOnly, catalog.musicAudio);
  router.get("/artists", subscriberOnly, catalog.listArtists);
  router.get("/albums", subscriberOnly, catalog.listAlbums);
  router.get("/albums/:id/cover", subscriberOnly, catalog.albumCover);
  router.get("/genres", subscriberOnly, catalog.listGenres);

  // Comentários
  router.get("/musics/:musicId/comments", authenticate, comments.listByMusic);
  router.post("/musics/:musicId/comments", authenticate, validateBody(createCommentSchema), comments.create);
  router.delete("/comments/:commentId", authenticate, comments.delete);
  router.post("/comments/:commentId/reports", authenticate, validateBody(reportCommentSchema), comments.report);

  // Painel dos admins da plataforma: tudo em /api/admin passa pelos dois middlewares.
  const adminRouter = Router();
  adminRouter.get("/stats", admin.stats);
  adminRouter.get("/users", admin.listUsers);
  adminRouter.post("/users", validateBody(createUserSchema), admin.createUser);
  adminRouter.delete("/users/:id", admin.removeUser);
  adminRouter.get("/users/:id/plays", admin.recentPlays);
  // Multipart: o JSON dos campos na parte "data" e o MP3 na parte "audio".
  adminRouter.post("/musics", receiveAudio, validateMultipartData(createMusicSchema), admin.createMusic);
  adminRouter.patch("/musics/:id", validateBody(updateMusicSchema), admin.updateMusic);
  adminRouter.delete("/musics/:id", admin.removeMusic);
  // Multipart: o JSON dos campos na parte "data" e a imagem na parte "cover".
  adminRouter.post("/albums", receiveCover, validateMultipartData(createAlbumSchema), admin.createAlbum);
  adminRouter.put("/albums/:id/cover", receiveCover, admin.changeAlbumCover);
  adminRouter.patch("/albums/:id", validateBody(updateAlbumSchema), admin.updateAlbum);
  adminRouter.delete("/albums/:id", admin.removeAlbum);
  adminRouter.post("/genres", validateBody(genreSchema), admin.createGenre);
  adminRouter.post("/artists", validateBody(artistSchema), admin.createArtist);
  adminRouter.patch("/artists/:id", validateBody(artistSchema), admin.renameArtist);
  adminRouter.delete("/artists/:id", admin.removeArtist);
  router.use("/admin", authenticate, requirePlatformAdmin, adminRouter);

  return router;
}
