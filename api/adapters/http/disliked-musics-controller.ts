import type { RequestHandler } from "express";
import type {
  DislikeMusicUseCase,
  ListMyDislikedMusicsUseCase,
  RemoveDislikeUseCase,
} from "../../domain/use-cases/disliked-musics.ts";

export interface DislikedMusicsUseCases {
  listMyDislikedMusics: ListMyDislikedMusicsUseCase;
  dislikeMusic: DislikeMusicUseCase;
  removeDislike: RemoveDislikeUseCase;
}

export interface DislikedMusicsController {
  list: RequestHandler;
  dislike: RequestHandler;
  removeDislike: RequestHandler;
}

// O dislike (HU-20), chamado pelo polegar para baixo do front. `:id` já passou pelo validateParams.
export function makeDislikedMusicsController(useCases: DislikedMusicsUseCases): DislikedMusicsController {
  return {
    list: async (_req, res) => {
      const musicIds = await useCases.listMyDislikedMusics.execute({ userId: res.locals.userId });

      res.json(musicIds);
    },
    dislike: async (req, res) => {
      await useCases.dislikeMusic.execute({
        userId: res.locals.userId,
        musicId: Number(req.params.id),
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });

      res.sendStatus(204);
    },
    removeDislike: async (req, res) => {
      await useCases.removeDislike.execute({ userId: res.locals.userId, musicId: Number(req.params.id) });

      res.sendStatus(204);
    },
  };
}
