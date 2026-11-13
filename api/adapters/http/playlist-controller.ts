import type { RequestHandler } from "express";
import type { AddMusicToPlaylistUseCase } from "../../domain/use-cases/add-music-to-playlist.ts";
import type { CreatePlaylistUseCase } from "../../domain/use-cases/create-playlist.ts";
import type { DeletePlaylistUseCase } from "../../domain/use-cases/delete-playlist.ts";
import type { GetPlaylistUseCase } from "../../domain/use-cases/get-playlist.ts";
import type { ListMyPlaylistsUseCase } from "../../domain/use-cases/list-my-playlists.ts";
import type { ListPlaylistMusicsUseCase } from "../../domain/use-cases/list-playlist-musics.ts";
import type { RemoveMusicFromPlaylistUseCase } from "../../domain/use-cases/remove-music-from-playlist.ts";
import type { ReorderPlaylistMusicsUseCase } from "../../domain/use-cases/reorder-playlist-musics.ts";
import type { UpdatePlaylistUseCase } from "../../domain/use-cases/update-playlist.ts";

export interface PlaylistUseCases {
  createPlaylist: CreatePlaylistUseCase;
  listMyPlaylists: ListMyPlaylistsUseCase;
  getPlaylist: GetPlaylistUseCase;
  updatePlaylist: UpdatePlaylistUseCase;
  deletePlaylist: DeletePlaylistUseCase;
  listPlaylistMusics: ListPlaylistMusicsUseCase;
  addMusicToPlaylist: AddMusicToPlaylistUseCase;
  removeMusicFromPlaylist: RemoveMusicFromPlaylistUseCase;
  reorderPlaylistMusics: ReorderPlaylistMusicsUseCase;
}

export interface PlaylistController {
  create: RequestHandler;
  list: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  listMusics: RequestHandler;
  addMusic: RequestHandler;
  removeMusic: RequestHandler;
  reorderMusics: RequestHandler;
}

// `:id` e `:musicId` já passaram pelo validateParams; o corpo, pelo validateBody.
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

    listMusics: async (req, res) => {
      const musics = await useCases.listPlaylistMusics.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
        playlistId: Number(req.params.id),
      });

      res.json(musics);
    },

    addMusic: async (req, res) => {
      const musics = await useCases.addMusicToPlaylist.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
        playlistId: Number(req.params.id),
        musicId: req.body.musicId,
      });

      res.status(201).json(musics);
    },

    removeMusic: async (req, res) => {
      await useCases.removeMusicFromPlaylist.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
        playlistId: Number(req.params.id),
        musicId: Number(req.params.musicId),
      });

      res.sendStatus(204);
    },

    reorderMusics: async (req, res) => {
      const musics = await useCases.reorderPlaylistMusics.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
        playlistId: Number(req.params.id),
        musicIds: req.body.musicIds,
      });

      res.json(musics);
    },
  };
}
