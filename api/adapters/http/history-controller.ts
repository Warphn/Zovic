import type { RequestHandler } from "express";
import type { ListMyHistoryUseCase } from "../../domain/use-cases/list-my-history.ts";
import type { ListMyListenedMusicsUseCase } from "../../domain/use-cases/list-my-listened-musics.ts";
import type { MarkMusicListenedUseCase } from "../../domain/use-cases/mark-music-listened.ts";

export interface HistoryUseCases {
  listMyHistory: ListMyHistoryUseCase;
  markMusicListened: MarkMusicListenedUseCase;
  listMyListenedMusics: ListMyListenedMusicsUseCase;
}

export interface HistoryController {
  list: RequestHandler;
  markListened: RequestHandler;
  listListened: RequestHandler;
}

export function makeHistoryController(useCases: HistoryUseCases): HistoryController {
  return {
    list: async (_req, res) => {
      const entries = await useCases.listMyHistory.execute({ userId: res.locals.userId });

      res.json(entries);
    },
    markListened: async (req, res) => {
      await useCases.markMusicListened.execute({
        userId: res.locals.userId,
        musicId: Number(req.params.id),
        playedSeconds: req.body.playedSeconds,
      });

      res.sendStatus(204);
    },
    listListened: async (_req, res) => {
      const entries = await useCases.listMyListenedMusics.execute({ userId: res.locals.userId });

      res.json(entries);
    },
  };
}
