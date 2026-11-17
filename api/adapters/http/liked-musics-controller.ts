import type { RequestHandler } from "express";
import type { LikeMusicUseCase, UnlikeMusicUseCase } from "../../domain/use-cases/liked-songs.ts";

export interface LikedMusicsUseCases {
  likeMusic: LikeMusicUseCase;
  unlikeMusic: UnlikeMusicUseCase;
}

export interface LikedMusicsController {
  like: RequestHandler;
  unlike: RequestHandler;
}

// O like da HU-20, que põe a música na Músicas Curtidas (HU-34). O coração do front chama estas
// rotas. `:id` já passou pelo validateParams.
export function makeLikedMusicsController(useCases: LikedMusicsUseCases): LikedMusicsController {
  return {
    like: async (req, res) => {
      await useCases.likeMusic.execute({
        userId: res.locals.userId,
        musicId: Number(req.params.id),
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });

      res.sendStatus(204);
    },
    unlike: async (req, res) => {
      await useCases.unlikeMusic.execute({ userId: res.locals.userId, musicId: Number(req.params.id) });

      res.sendStatus(204);
    },
  };
}
