import { BetterAuthUserAccounts } from "../adapters/auth/better-auth-user-accounts.ts";
import { PostgresAdminQueries, PostgresCatalogQueries } from "../adapters/db/postgres-admin-queries.ts";
import { PostgresArtistRepository } from "../adapters/db/postgres-artist-repository.ts";
import { PostgresGenreRepository } from "../adapters/db/postgres-genre-repository.ts";
import { PostgresMusicRepository } from "../adapters/db/postgres-music-repository.ts";
import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { makeAdminController, makeCatalogController } from "../adapters/http/admin-controller.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { ManageCatalog } from "../domain/use-cases/manage-catalog.ts";
import { ManageUsers } from "../domain/use-cases/manage-users.ts";
import { pool } from "./db/pool.ts";

export function composeApp(auth: Auth, trustProxy: number | null, corsOrigins: string[] = []) {
  const playlistRepository = new PostgresPlaylistRepository(pool);
  const createPlaylist = new CreatePlaylist(playlistRepository);
  const playlistController = makePlaylistController(createPlaylist);

  const catalogQueries = new PostgresCatalogQueries(pool);
  const catalogController = makeCatalogController(catalogQueries, catalogQueries);

  const manageCatalog = new ManageCatalog(
    new PostgresMusicRepository(pool),
    new PostgresArtistRepository(pool),
    new PostgresGenreRepository(pool),
  );
  const manageUsers = new ManageUsers(new BetterAuthUserAccounts(auth, pool));
  const adminController = makeAdminController(new PostgresAdminQueries(pool), manageUsers, manageCatalog);

  const router = makeRouter(
    { playlists: playlistController, catalog: catalogController, admin: adminController },
    makeAuthenticate(auth),
  );

  return createApp({ auth, router, trustProxy, corsOrigins });
}
