import { BetterAuthUserAccounts } from "../adapters/auth/better-auth-user-accounts.ts";
import { PostgresAdminQueries, PostgresCatalogQueries } from "../adapters/db/postgres-admin-queries.ts";
import { PostgresAlbumRepository } from "../adapters/db/postgres-album-repository.ts";
import { PostgresArtistRepository } from "../adapters/db/postgres-artist-repository.ts";
import { PostgresCommentRepository } from "../adapters/db/postgres-comment-repository.ts";
import { PostgresGenreRepository } from "../adapters/db/postgres-genre-repository.ts";
import { PostgresMusicRepository } from "../adapters/db/postgres-music-repository.ts";
import { PostgresPlayHistory } from "../adapters/db/postgres-play-history.ts";
import { PostgresPlaylistMusics } from "../adapters/db/postgres-playlist-musics.ts";
import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import { PostgresSearchQuery } from "../adapters/db/postgres-search-query.ts";
import { PostgresSubscriptionRepository } from "../adapters/db/postgres-subscription-repository.ts";
import { PostgresUserRepository } from "../adapters/db/postgres-user-repository.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { makeSubscriptionController } from "../adapters/http/subscription-controller.ts";
import { AcceptInvitation } from "../domain/use-cases/accept-invitation.ts";
import { CancelPlanInvitation } from "../domain/use-cases/cancel-plan-invitation.ts";
import { GetInvitation } from "../domain/use-cases/get-invitation.ts";
import { GetPlanMembers } from "../domain/use-cases/get-plan-members.ts";
import { InviteToPlan } from "../domain/use-cases/invite-to-plan.ts";
import { LeavePlan } from "../domain/use-cases/leave-plan.ts";
import { RemovePlanMember } from "../domain/use-cases/remove-plan-member.ts";
import { CancelSubscription } from "../domain/use-cases/cancel-subscription.ts";
import { GetMySubscription } from "../domain/use-cases/get-my-subscription.ts";
import { SubscribePlan } from "../domain/use-cases/subscribe-plan.ts";
import { makeAdminController, makeCatalogController } from "../adapters/http/admin-controller.ts";
import { makeCommentController } from "../adapters/http/comment-controller.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makeRequireSubscription } from "../adapters/http/middlewares/require-subscription.ts";
import { makeHistoryController } from "../adapters/http/history-controller.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { makeSearchController } from "../adapters/http/search-controller.ts";
import { LocalFileStorage } from "../adapters/storage/local-file-storage.ts";
import { AddMusicToPlaylist } from "../domain/use-cases/add-music-to-playlist.ts";
import { CreateComment } from "../domain/use-cases/create-comment.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { DeleteComment } from "../domain/use-cases/delete-comment.ts";
import { DeletePlaylist } from "../domain/use-cases/delete-playlist.ts";
import { GetPlaylist } from "../domain/use-cases/get-playlist.ts";
import { ListMusicComments } from "../domain/use-cases/list-music-comments.ts";
import { ListMyHistory } from "../domain/use-cases/list-my-history.ts";
import { ListMyPlaylists } from "../domain/use-cases/list-my-playlists.ts";
import { ListPlaylistMusics } from "../domain/use-cases/list-playlist-musics.ts";
import { ManageCatalog } from "../domain/use-cases/manage-catalog.ts";
import { ManageUsers } from "../domain/use-cases/manage-users.ts";
import { RemoveMusicFromPlaylist } from "../domain/use-cases/remove-music-from-playlist.ts";
import { ReorderPlaylistMusics } from "../domain/use-cases/reorder-playlist-musics.ts";
import { ReportComment } from "../domain/use-cases/report-comment.ts";
import { SearchCatalog } from "../domain/use-cases/search-catalog.ts";
import { UpdatePlaylist } from "../domain/use-cases/update-playlist.ts";
import type { Pool } from "pg";
import { pool } from "./db/pool.ts";
import { config } from "./config.ts";

/** Onde ficam os arquivos enviados pelo painel; os testes passam diretórios temporários. */
export interface MediaStorages {
  audio: LocalFileStorage;
  covers: LocalFileStorage;
}

export function composeApp(
  auth: Auth,
  trustProxy: number | null,
  corsOrigins: string[] = [],
  db: Pool = pool,
  storages: MediaStorages = { audio: new LocalFileStorage(config.audioDir), covers: new LocalFileStorage(config.coverDir) },
) {
  const playlistRepository = new PostgresPlaylistRepository(db);
  const playlistMusics = new PostgresPlaylistMusics(db);
  const playlistController = makePlaylistController({
    createPlaylist: new CreatePlaylist(playlistRepository),
    listMyPlaylists: new ListMyPlaylists(playlistRepository),
    getPlaylist: new GetPlaylist(playlistRepository),
    updatePlaylist: new UpdatePlaylist(playlistRepository),
    deletePlaylist: new DeletePlaylist(playlistRepository),
    listPlaylistMusics: new ListPlaylistMusics(playlistRepository, playlistMusics),
    addMusicToPlaylist: new AddMusicToPlaylist(playlistRepository, playlistMusics),
    removeMusicFromPlaylist: new RemoveMusicFromPlaylist(playlistRepository, playlistMusics),
    reorderPlaylistMusics: new ReorderPlaylistMusics(playlistRepository, playlistMusics),
  });
  const searchController = makeSearchController(new SearchCatalog(new PostgresSearchQuery(db)));

  const catalogQueries = new PostgresCatalogQueries(db);
  const catalogController = makeCatalogController(catalogQueries, catalogQueries, storages.covers);

  const manageCatalog = new ManageCatalog(
    new PostgresMusicRepository(db),
    new PostgresArtistRepository(db),
    new PostgresGenreRepository(db),
    new PostgresAlbumRepository(db),
    storages.audio,
    storages.covers,
  );
  const manageUsers = new ManageUsers(new BetterAuthUserAccounts(auth, db));
  const adminController = makeAdminController(new PostgresAdminQueries(db), manageUsers, manageCatalog);

  const userRepository = new PostgresUserRepository(db);
  const commentRepository = new PostgresCommentRepository(db);
  const createComment = new CreateComment(commentRepository, userRepository);
  const listComments = new ListMusicComments(commentRepository, userRepository);
  const deleteComment = new DeleteComment(commentRepository, userRepository);
  const reportComment = new ReportComment(commentRepository, userRepository);
  const commentController = makeCommentController(createComment, listComments, deleteComment, reportComment);

  const subscriptionRepository = new PostgresSubscriptionRepository(db);
  const getMySubscription = new GetMySubscription(subscriptionRepository);
  const subscriptionController = makeSubscriptionController({
    subscribePlan: new SubscribePlan(subscriptionRepository),
    getMySubscription,
    cancelSubscription: new CancelSubscription(subscriptionRepository),
    getPlanMembers: new GetPlanMembers(subscriptionRepository),
    inviteToPlan: new InviteToPlan(subscriptionRepository),
    cancelPlanInvitation: new CancelPlanInvitation(subscriptionRepository),
    removePlanMember: new RemovePlanMember(subscriptionRepository),
    leavePlan: new LeavePlan(subscriptionRepository),
    getInvitation: new GetInvitation(subscriptionRepository),
    acceptInvitation: new AcceptInvitation(subscriptionRepository),
  });

  const historyController = makeHistoryController({ listMyHistory: new ListMyHistory(new PostgresPlayHistory(db)) });

  const router = makeRouter(
    {
      playlists: playlistController,
      search: searchController,
      catalog: catalogController,
      admin: adminController,
      comments: commentController,
      subscriptions: subscriptionController,
      history: historyController,
    },
    makeAuthenticate(auth),
    makeRequireSubscription(getMySubscription),
  );

  return createApp({ auth, router, trustProxy, corsOrigins });
}
