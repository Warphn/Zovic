import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { pool } from "./db/pool.ts";

const playlistRepository = new PostgresPlaylistRepository(pool);
const createPlaylist = new CreatePlaylist(playlistRepository);

export const router = makeRouter(makePlaylistController(createPlaylist));
