import { describe, expect, it } from "bun:test";
import type { SearchParams, SearchQuery, SearchResults } from "../ports/search-query.ts";
import { SEARCH_LIMIT, SearchCatalog } from "./search-catalog.ts";

const RESULTS: SearchResults = {
  musics: [{ id: 1, name: "Águas de Março", duration: 212, artists: [{ id: 3, name: "Elis Regina" }] }],
  artists: [{ id: 3, name: "Elis Regina", musicCount: 7 }],
  albums: [{ id: 5, name: "Elis", year: 1972, coverUrl: null, artists: [{ id: 3, name: "Elis Regina" }], musicCount: 12 }],
  playlists: [{ id: 42, name: "Água fresca", isPrivate: false, color: "#1DB954", musicCount: 10 }],
};

class FakeSearchQuery implements SearchQuery {
  readonly calls: SearchParams[] = [];

  search(params: SearchParams): Promise<SearchResults> {
    this.calls.push(params);
    return Promise.resolve(RESULTS);
  }
}

const ADULT = "1990-01-01";
const NOW = new Date("2026-11-12T15:00:00Z");

function setup() {
  const query = new FakeSearchQuery();
  return { query, useCase: new SearchCatalog(query) };
}

describe("SearchCatalog", () => {
  it("repassa o termo sem espaços nas pontas e quem busca, e devolve os grupos", async () => {
    const { query, useCase } = setup();

    const output = await useCase.execute({ userId: 7, birthdate: ADULT, term: "  agua  ", limit: 4, now: NOW });

    expect(output).toEqual(RESULTS);
    expect(query.calls).toEqual([{ term: "agua", viewerId: 7, hideExplicit: false, limit: 4 }]);
  });

  it("esconde as músicas explícitas de quem é menor, até o dia em que faz 18 anos (HU-09)", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, birthdate: "2008-11-13", term: "rock", now: NOW });
    await useCase.execute({ userId: 7, birthdate: "2008-11-12", term: "rock", now: NOW });
    await useCase.execute({ userId: 7, birthdate: null, term: "rock", now: NOW });

    expect(query.calls.map((call) => call.hideExplicit)).toEqual([true, false, true]);
  });

  it("devolve os quatro grupos vazios para termo em branco, sem consultar", async () => {
    const { query, useCase } = setup();

    const output = await useCase.execute({ userId: 7, birthdate: ADULT, term: "   " });

    expect(output).toEqual({ musics: [], artists: [], albums: [], playlists: [] });
    expect(query.calls).toHaveLength(0);
  });

  it("usa o limite padrão quando não vem nenhum", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, birthdate: ADULT, term: "rock" });

    expect(query.calls[0]?.limit).toBe(SEARCH_LIMIT.default);
  });

  it("mantém o limite entre 1 e o máximo", async () => {
    const { query, useCase } = setup();

    await useCase.execute({ userId: 7, birthdate: ADULT, term: "rock", limit: 500 });
    await useCase.execute({ userId: 7, birthdate: ADULT, term: "rock", limit: 0 });

    expect(query.calls.map((call) => call.limit)).toEqual([SEARCH_LIMIT.max, 1]);
  });
});
