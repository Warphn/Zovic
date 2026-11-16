import { canSeeExplicit } from "../shared/age.ts";
import type { SearchQuery, SearchResults } from "../ports/search-query.ts";

/** Itens por grupo: a barra do cabeçalho pede poucos, a página de busca pede o máximo. */
export const SEARCH_LIMIT = { default: 5, max: 50 } as const;

export interface SearchCatalogInput {
  userId: number;
  term: string;
  limit?: number;
  /** "AAAA-MM-DD" de quem pede; null conta como menor de idade. */
  birthdate: string | null;
  now: Date;
  /** Admin da plataforma vê as músicas explícitas mesmo sem ser maior de idade. */
  isAdmin?: boolean;
}

export type SearchCatalogOutput = SearchResults;

export interface SearchCatalogUseCase {
  execute(input: SearchCatalogInput): Promise<SearchCatalogOutput>;
}

export class SearchCatalog implements SearchCatalogUseCase {
  constructor(private readonly query: SearchQuery) {}

  async execute({
    userId,
    term,
    limit = SEARCH_LIMIT.default,
    birthdate,
    now,
    isAdmin = false,
  }: SearchCatalogInput): Promise<SearchCatalogOutput> {
    const trimmed = term.trim();
    if (!trimmed) return { musics: [], artists: [], playlists: [] };

    return this.query.search({
      term: trimmed,
      viewerId: userId,
      includeExplicit: canSeeExplicit(birthdate, now, isAdmin),
      limit: Math.min(Math.max(Math.trunc(limit), 1), SEARCH_LIMIT.max),
    });
  }
}
