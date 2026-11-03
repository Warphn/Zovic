import type { Auth } from "../adapters/auth/create-auth.ts";
import { PostgresCommentRepository } from "../adapters/db/postgres-comment-repository.ts";
import { PostgresPlaylistRepository } from "../adapters/db/postgres-playlist-repository.ts";
import { PostgresUserRepository } from "../adapters/db/postgres-user-repository.ts";
import { makeCommentController } from "../adapters/http/comment-controller.ts";
import { createApp } from "../adapters/http/create-app.ts";
import { makeAuthenticate } from "../adapters/http/middlewares/authenticate.ts";
import { makePlaylistController } from "../adapters/http/playlist-controller.ts";
import { makeRouter } from "../adapters/http/routes.ts";
import { CreateComment } from "../domain/use-cases/create-comment.ts";
import { CreatePlaylist } from "../domain/use-cases/create-playlist.ts";
import { DeleteComment } from "../domain/use-cases/delete-comment.ts";
import { ListMusicComments } from "../domain/use-cases/list-music-comments.ts";
import { ReportComment } from "../domain/use-cases/report-comment.ts";
import { pool } from "./db/pool.ts";

export function composeApp(auth: Auth, trustProxy: number | null, corsOrigins: string[] = []) {
  const playlistRepository = new PostgresPlaylistRepository(pool);
  const userRepository = new PostgresUserRepository(pool);
  const commentRepository = new PostgresCommentRepository(pool);

  const createPlaylist = new CreatePlaylist(playlistRepository);
  const createComment = new CreateComment(commentRepository, userRepository);
  const listComments = new ListMusicComments(commentRepository, userRepository);
  const deleteComment = new DeleteComment(commentRepository, userRepository);
  const reportComment = new ReportComment(commentRepository, userRepository);

  const playlistController = makePlaylistController(createPlaylist);
  const commentController = makeCommentController(createComment, listComments, deleteComment, reportComment);

  const router = makeRouter(
    {
      playlists: playlistController,
      comments: commentController,
    },
    makeAuthenticate(auth),
  );

  return createApp({ auth, router, trustProxy, corsOrigins });
}
