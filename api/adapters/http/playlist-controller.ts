import type { RequestHandler } from "express";
import type { CreatePlaylistUseCase } from "../../domain/use-cases/create-playlist.ts";
import type { DeletePlaylistUseCase } from "../../domain/use-cases/delete-playlist.ts";
import type { GetPlaylistUseCase } from "../../domain/use-cases/get-playlist.ts";
import type { ListMyPlaylistsUseCase } from "../../domain/use-cases/list-my-playlists.ts";
import type { UpdatePlaylistUseCase } from "../../domain/use-cases/update-playlist.ts";

export interface PlaylistUseCases {
  createPlaylist: CreatePlaylistUseCase;
  listMyPlaylists: ListMyPlaylistsUseCase;
  getPlaylist: GetPlaylistUseCase;
  updatePlaylist: UpdatePlaylistUseCase;
  deletePlaylist: DeletePlaylistUseCase;
}

export interface PlaylistController {
  create: RequestHandler;
  list: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

// `:id` já passou pelo validateParams(playlistIdParamsSchema).
export function makePlaylistController(useCases: PlaylistUseCases): PlaylistController {
  return {
    create: async (req, res) => {
      const playlist = await useCases.createPlaylist.execute({
        creatorId: res.locals.userId,
        name: req.body.name,
        isPrivate: req.body.isPrivate,
        color: req.body.color,
      });

      res.status(201).json(playlist);
    },

    list: async (_req, res) => {
      const playlists = await useCases.listMyPlaylists.execute({ userId: res.locals.userId });

      res.json(playlists);
    },

    get: async (req, res) => {
      const playlist = await useCases.getPlaylist.execute({
        userId: res.locals.userId,
        playlistId: Number(req.params.id),
      });

      res.json(playlist);
    },

    update: async (req, res) => {
      const playlist = await useCases.updatePlaylist.execute({
        userId: res.locals.userId,
        playlistId: Number(req.params.id),
        name: req.body.name,
        isPrivate: req.body.isPrivate,
        color: req.body.color,
      });

      res.json(playlist);
    },

    remove: async (req, res) => {
      await useCases.deletePlaylist.execute({
        userId: res.locals.userId,
        playlistId: Number(req.params.id),
      });

      res.sendStatus(204);
    },
  };
}
