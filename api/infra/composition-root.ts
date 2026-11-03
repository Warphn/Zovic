import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { DeletePlaylist } from "../domain/use-cases/delete-playlist.ts";
import { GetPlaylist } from "../domain/use-cases/get-playlist.ts";
import { ListMyPlaylists } from "../domain/use-cases/list-my-playlists.ts";
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
  const router = makeRouter(playlistController, makeAuthenticate(auth));

  return createApp({ auth, router, trustProxy, corsOrigins });
}
