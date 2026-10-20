import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import type { Auth } from "../adapters/auth/create-auth.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { pool } from "./db/pool.ts";

export function composeApp(auth: Auth, trustProxy: number | null) {
  const playlistRepository = new PostgresPlaylistRepository(pool);
  const createPlaylist = new CreatePlaylist(playlistRepository);
  const playlistController = makePlaylistController(createPlaylist);
  const router = makeRouter(playlistController, makeAuthenticate(auth));

  return createApp({ auth, router, trustProxy });
}
