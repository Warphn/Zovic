import type { RequestHandler } from "express";
import type { SearchCatalogUseCase } from "../../domain/use-cases/search-catalog.ts";

export interface SearchController {
  search: RequestHandler;
}

// `res.locals.query` já passou pelo validateQuery(searchQuerySchema).
export function makeSearchController(searchCatalog: SearchCatalogUseCase): SearchController {
  return {
    search: async (_req, res) => {
      const { q, limit } = res.locals.query;
      const results = await searchCatalog.execute({
        userId: res.locals.userId,
        term: String(q),
        limit: Number(limit),
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });

      res.json(results);
    },
  };
}
