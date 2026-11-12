import type { SearchQuery, SearchResults } from "../ports/search-query.ts";
import { calendarDateIn, isAdult, TIME_ZONE } from "../shared/age.ts";

/** Itens por grupo: a barra do cabeçalho pede poucos, a página de busca pede o máximo. */
export const SEARCH_LIMIT = { default: 5, max: 50 } as const;

export interface SearchCatalogInput {
  userId: number;
  /** "AAAA-MM-DD" de quem busca; sem data, vale a regra de menor (HU-09). */
  birthdate: string | null;
  term: string;
  limit?: number;
  now?: Date;
}

export type SearchCatalogOutput = SearchResults;

export interface SearchCatalogUseCase {
  execute(input: SearchCatalogInput): Promise<SearchCatalogOutput>;
}

export class SearchCatalog implements SearchCatalogUseCase {
  constructor(private readonly query: SearchQuery) {}

  async execute({
    userId,
    birthdate,
    term,
    limit = SEARCH_LIMIT.default,
    now = new Date(),
  }: SearchCatalogInput): Promise<SearchCatalogOutput> {
    const trimmed = term.trim();
    if (!trimmed) return { musics: [], artists: [], albums: [], playlists: [] };

    return this.query.search({
      term: trimmed,
      viewerId: userId,
      hideExplicit: !isAdult(birthdate, calendarDateIn(now, TIME_ZONE)),
      limit: Math.min(Math.max(Math.trunc(limit), 1), SEARCH_LIMIT.max),
    });
  }
}
