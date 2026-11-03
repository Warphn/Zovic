import type { SearchQuery, SearchResults } from "../ports/search-query.ts";

/** Itens por grupo: a barra do cabeçalho pede poucos, a página de busca pede o máximo. */
export const SEARCH_LIMIT = { default: 5, max: 50 } as const;

export interface SearchCatalogInput {
  userId: number;
  term: string;
  limit?: number;
}

export type SearchCatalogOutput = SearchResults;

export interface SearchCatalogUseCase {
  execute(input: SearchCatalogInput): Promise<SearchCatalogOutput>;
}

export class SearchCatalog implements SearchCatalogUseCase {
  constructor(private readonly query: SearchQuery) {}

  async execute({ userId, term, limit = SEARCH_LIMIT.default }: SearchCatalogInput): Promise<SearchCatalogOutput> {
    const trimmed = term.trim();
    if (!trimmed) return { musics: [], artists: [], playlists: [] };

    return this.query.search({
      term: trimmed,
      viewerId: userId,
      limit: Math.min(Math.max(Math.trunc(limit), 1), SEARCH_LIMIT.max),
    });
  }
}
