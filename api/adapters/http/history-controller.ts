import type { RequestHandler } from "express";
import type { ListMyHistoryUseCase } from "../../domain/use-cases/list-my-history.ts";

export interface HistoryUseCases {
  listMyHistory: ListMyHistoryUseCase;
}

export interface HistoryController {
  list: RequestHandler;
}

export function makeHistoryController(useCases: HistoryUseCases): HistoryController {
  return {
    list: async (_req, res) => {
      const entries = await useCases.listMyHistory.execute({
        userId: res.locals.userId,
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });

      res.json(entries);
    },
  };
}
