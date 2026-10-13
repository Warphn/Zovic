import type { RequestHandler } from "express";
import type { CreatePlaylistUseCase } from "../../domain/use-cases/create-playlist.ts";

export interface PlaylistController {
  create: RequestHandler;
}

export function makePlaylistController(createPlaylist: CreatePlaylistUseCase): PlaylistController {
  return {
    create: async (req, res) => {
      const playlist = await createPlaylist.execute({
        creatorId: res.locals.userId,
        name: req.body.name,
        isPrivate: req.body.isPrivate,
        color: req.body.color,
      });

      res.status(201).json(playlist);
    },
  };
}
