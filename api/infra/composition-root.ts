import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import { PostgresSearchQuery } from "../adapters/db/postgres-search-query.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { makeSearchController } from "../adapters/http/search-controller.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { DeletePlaylist } from "../domain/use-cases/delete-playlist.ts";
import { GetPlaylist } from "../domain/use-cases/get-playlist.ts";
import { ListMyPlaylists } from "../domain/use-cases/list-my-playlists.ts";
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
  const router = makeRouter({ playlists: playlistController, search: searchController }, makeAuthenticate(auth));

  return createApp({ auth, router, trustProxy, corsOrigins });
}
