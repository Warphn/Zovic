import { BetterAuthUserAccounts } from "../adapters/auth/better-auth-user-accounts.ts";
import { PostgresAdminQueries, PostgresCatalogQueries } from "../adapters/db/postgres-admin-queries.ts";
import { PostgresArtistRepository } from "../adapters/db/postgres-artist-repository.ts";
import { PostgresCommentRepository } from "../adapters/db/postgres-comment-repository.ts";
import { PostgresGenreRepository } from "../adapters/db/postgres-genre-repository.ts";
import { PostgresMusicRepository } from "../adapters/db/postgres-music-repository.ts";
import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import { PostgresSearchQuery } from "../adapters/db/postgres-search-query.ts";
import { PostgresUserRepository } from "../adapters/db/postgres-user-repository.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { makeAdminController, makeCatalogController } from "../adapters/http/admin-controller.ts";
import { makeCommentController } from "../adapters/http/comment-controller.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { makeSearchController } from "../adapters/http/search-controller.ts";
import { CreateComment } from "../domain/use-cases/create-comment.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { DeleteComment } from "../domain/use-cases/delete-comment.ts";
import { DeletePlaylist } from "../domain/use-cases/delete-playlist.ts";
import { GetPlaylist } from "../domain/use-cases/get-playlist.ts";
import { ListMusicComments } from "../domain/use-cases/list-music-comments.ts";
import { ListMyPlaylists } from "../domain/use-cases/list-my-playlists.ts";
import { ManageCatalog } from "../domain/use-cases/manage-catalog.ts";
import { ManageUsers } from "../domain/use-cases/manage-users.ts";
import { ReportComment } from "../domain/use-cases/report-comment.ts";
import { SearchCatalog } from "../domain/use-cases/search-catalog.ts";
import { UpdatePlaylist } from "../domain/use-cases/update-playlist.ts";
import type { Pool } from "pg";
import { pool } from "./db/pool.ts";

export function composeApp(auth: Auth, trustProxy: number | null, corsOrigins: string[] = [], db: Pool = pool) {
  const playlistRepository = new PostgresPlaylistRepository(db);
  const playlistController = makePlaylistController({
    createPlaylist: new CreatePlaylist(playlistRepository),
    listMyPlaylists: new ListMyPlaylists(playlistRepository),
    getPlaylist: new GetPlaylist(playlistRepository),
    updatePlaylist: new UpdatePlaylist(playlistRepository),
    deletePlaylist: new DeletePlaylist(playlistRepository),
  });
  const searchController = makeSearchController(new SearchCatalog(new PostgresSearchQuery(db)));

  const catalogQueries = new PostgresCatalogQueries(db);
  const catalogController = makeCatalogController(catalogQueries, catalogQueries);

  const manageCatalog = new ManageCatalog(
    new PostgresMusicRepository(db),
    new PostgresArtistRepository(db),
    new PostgresGenreRepository(db),
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

  const router = makeRouter(
    {
      playlists: playlistController,
      search: searchController,
      catalog: catalogController,
      admin: adminController,
      comments: commentController,
    },
    makeAuthenticate(auth),
  );

  return createApp({ auth, router, trustProxy, corsOrigins });
}
