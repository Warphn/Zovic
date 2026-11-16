import { describe, expect, it } from "bun:test";
import type { SearchParams, SearchQuery, SearchResults } from "../ports/search-query.ts";
import { SEARCH_LIMIT, SearchCatalog } from "./search-catalog.ts";

const RESULTS: SearchResults = {
  musics: [{ id: 1, name: "Águas de Março", duration: 212, artists: [{ id: 3, name: "Elis Regina" }] }],
  artists: [{ id: 3, name: "Elis Regina", musicCount: 7 }],
  playlists: [{ id: 42, name: "Água fresca", isPrivate: false, color: "#1DB954", musicCount: 10 }],
};

class FakeSearchQuery implements SearchQuery {
  readonly calls: SearchParams[] = [];

  search(params: SearchParams): Promise<SearchResults> {
    this.calls.push(params);
    return Promise.resolve(RESULTS);
  }
}

const NOW = new Date("2026-11-06T15:00:00Z");
const ADULT = "1995-03-12";
const MINOR = "2010-01-01";

function setup() {
  const query = new FakeSearchQuery();
  return { query, useCase: new SearchCatalog(query) };
}

describe("SearchCatalog", () => {
  it("repassa o termo sem espaços nas pontas e quem busca, e devolve os grupos", async () => {
    const { query, useCase } = setup();

    const output = await useCase.execute({ userId: 7, term: "  agua  ", limit: 4, birthdate: ADULT, now: NOW });

    expect(output).toEqual(RESULTS);
    expect(query.calls).toEqual([{ term: "agua", viewerId: 7, limit: 4, includeExplicit: true }]);
  });

  it("devolve os três grupos vazios para termo em branco, sem consultar", async () => {
    const { query, useCase } = setup();

    const output = await useCase.execute({ userId: 7, term: "   ", birthdate: ADULT, now: NOW });

    expect(output).toEqual({ musics: [], artists: [], playlists: [] });
    expect(query.calls).toHaveLength(0);
  });

  it("usa o limite padrão quando não vem nenhum", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, term: "rock", birthdate: ADULT, now: NOW });

    expect(query.calls[0]?.limit).toBe(SEARCH_LIMIT.default);
  });

  it("mantém o limite entre 1 e o máximo", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, term: "rock", limit: 500, birthdate: ADULT, now: NOW });
    await useCase.execute({ userId: 7, term: "rock", limit: 0, birthdate: ADULT, now: NOW });

    expect(query.calls.map((call) => call.limit)).toEqual([SEARCH_LIMIT.max, 1]);
  });

  it("esconde as músicas explícitas de menor de idade e de quem não tem data de nascimento", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, term: "rock", birthdate: MINOR, now: NOW });
    await useCase.execute({ userId: 7, term: "rock", birthdate: null, now: NOW });

    expect(query.calls.map((call) => call.includeExplicit)).toEqual([false, false]);
  });

  it("mostra as explícitas para quem faz 18 anos hoje e para admin", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, term: "rock", birthdate: "2008-11-06", now: NOW });
    await useCase.execute({ userId: 7, term: "rock", birthdate: null, now: NOW, isAdmin: true });

    expect(query.calls.map((call) => call.includeExplicit)).toEqual([true, true]);
  });
});
