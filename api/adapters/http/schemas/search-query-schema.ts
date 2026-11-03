import Joi from "joi";
import { SEARCH_LIMIT } from "../../../domain/use-cases/search-catalog.ts";

// `?q=agua&limit=4`: chegam como texto; o Joi converte `limit` para número.
export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required(),
  limit: Joi.number().integer().min(1).max(SEARCH_LIMIT.max).default(SEARCH_LIMIT.default),
});
