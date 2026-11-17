import type { RequestHandler } from "express";
import type { RecommendMusicsUseCase } from "../../domain/use-cases/recommend-musics.ts";

export interface RecommendationUseCases {
  recommendMusics: RecommendMusicsUseCase;
}

export interface RecommendationController {
  list: RequestHandler;
}

export function makeRecommendationController(useCases: RecommendationUseCases): RecommendationController {
  return {
    list: async (_req, res) => {
      const musics = await useCases.recommendMusics.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });

      res.json(musics);
    },
  };
}
