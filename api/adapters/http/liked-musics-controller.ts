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

// Músicas Curtidas (HU-34): o coração do front chama estas rotas até a curtida da HU-20 ir para a
// API; depois, o voto chama os mesmos casos de uso. `:id` já passou pelo validateParams.
export function makeLikedMusicsController(useCases: LikedMusicsUseCases): LikedMusicsController {
  return {
    like: async (req, res) => {
      await useCases.likeMusic.execute({ userId: res.locals.userId, musicId: Number(req.params.id) });

      res.sendStatus(204);
    },
    unlike: async (req, res) => {
      await useCases.unlikeMusic.execute({ userId: res.locals.userId, musicId: Number(req.params.id) });

      res.sendStatus(204);
    },
  };
}
