import { describe, expect, it } from "bun:test";
import { InMemoryRecommendationSource, type CatalogMusic } from "../testing/in-memory-recommendation-source.ts";
import { RECOMMENDATION_COUNT, RecommendMusics } from "./recommend-musics.ts";

const ANA = 1;
const ROCK = 1;
const JAZZ = 2;
const QUEEN = 1;
const MILES = 2;
const NOW = new Date("2026-11-16T15:00:00Z");
const ADULT = { birthdate: "1995-03-12", now: NOW };
const MINOR = { birthdate: "2010-01-01", now: NOW };

let nextMusicId = 100;

function music(overrides: Partial<CatalogMusic> & Pick<CatalogMusic, "genreIds">): CatalogMusic {
  nextMusicId += 1;
  return { id: nextMusicId, name: `Música ${nextMusicId}`, duration: 200, artists: [], streams: 0, ...overrides };
}

function makeSource(...catalog: CatalogMusic[]): InMemoryRecommendationSource {
  const source = new InMemoryRecommendationSource();
  source.catalog.push(...catalog);
  return source;
}

async function recommendedIds(source: InMemoryRecommendationSource, who = ADULT): Promise<number[]> {
  const output = await new RecommendMusics(source).execute({ userId: ANA, ...who });
  return output.map((entry) => entry.id);
}

describe("RecommendMusics", () => {
  it("dá maioria de rock a quem só ouviu rock e nunca repete uma música já ouvida", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const otherRock = music({ genreIds: [ROCK] });
    const anotherRock = music({ genreIds: [ROCK] });
    const jazz = music({ genreIds: [JAZZ], streams: 1000 });
    const source = makeSource(heardRock, otherRock, anotherRock, jazz);
    source.listenedByUser.set(ANA, [heardRock.id]);

    const ids = await recommendedIds(source);

    expect(ids.slice(0, 2)).toEqual([otherRock.id, anotherRock.id]);
    expect(ids).not.toContain(heardRock.id);
  });

  it("pontua também pelo artista", async () => {
    const heard = music({ genreIds: [ROCK], artists: [{ id: QUEEN, name: "Queen" }] });
    const sameArtist = music({ genreIds: [JAZZ], artists: [{ id: QUEEN, name: "Queen" }] });
    const unrelated = music({ genreIds: [JAZZ], artists: [{ id: MILES, name: "Miles" }], streams: 1000 });
    const source = makeSource(heard, unrelated, sameArtist);
    source.listenedByUser.set(ANA, [heard.id]);

    expect(await recommendedIds(source)).toEqual([sameArtist.id, unrelated.id]);
  });

  it("deixa a música curtida moldar o perfil, com o mesmo peso de uma ouvida", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const likedJazz = music({ genreIds: [JAZZ] });
    const rockCandidate = music({ genreIds: [ROCK] });
    const jazzCandidate = music({ genreIds: [JAZZ], streams: 5 });
    const source = makeSource(heardRock, likedJazz, rockCandidate, jazzCandidate);
    source.listenedByUser.set(ANA, [heardRock.id]);
    source.likedByUser.set(ANA, [likedJazz.id]);

    expect(await recommendedIds(source)).toEqual([jazzCandidate.id, likedJazz.id, rockCandidate.id]);
  });

  it("dá peso dobrado à música ouvida e curtida", async () => {
    const heardAndLikedRock = music({ genreIds: [ROCK] });
    const heardJazz = music({ genreIds: [JAZZ] });
    const rockCandidate = music({ genreIds: [ROCK] });
    const jazzCandidate = music({ genreIds: [JAZZ], streams: 5 });
    const source = makeSource(heardAndLikedRock, heardJazz, rockCandidate, jazzCandidate);
    source.listenedByUser.set(ANA, [heardAndLikedRock.id, heardJazz.id]);
    source.likedByUser.set(ANA, [heardAndLikedRock.id]);

    expect(await recommendedIds(source)).toEqual([rockCandidate.id, jazzCandidate.id]);
  });

  it("recomenda as mais tocadas a quem não ouviu nem curtiu nada", async () => {
    const quiet = music({ genreIds: [ROCK], streams: 1 });
    const popular = music({ genreIds: [JAZZ], streams: 90 });
    const tied = music({ genreIds: [ROCK], streams: 1 });

    expect(await recommendedIds(makeSource(quiet, popular, tied))).toEqual([popular.id, quiet.id, tied.id]);
  });

  it("não trata quem só curtiu como conta sem histórico", async () => {
    const likedRock = music({ genreIds: [ROCK] });
    const rockCandidate = music({ genreIds: [ROCK] });
    const popularJazz = music({ genreIds: [JAZZ], streams: 90 });
    const source = makeSource(likedRock, rockCandidate, popularJazz);
    source.likedByUser.set(ANA, [likedRock.id]);

    expect((await recommendedIds(source))[0]).toBe(likedRock.id);
  });

  it("não entrega música explícita a menor de idade, com perfil ou sem histórico", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const explicitRock = music({ genreIds: [ROCK], isExplicit: true, streams: 500 });
    const commonRock = music({ genreIds: [ROCK] });
    const source = makeSource(heardRock, explicitRock, commonRock);

    expect(await recommendedIds(source, MINOR)).toEqual([heardRock.id, commonRock.id]);

    source.listenedByUser.set(ANA, [heardRock.id]);
    expect(await recommendedIds(source, MINOR)).toEqual([commonRock.id]);
    expect(await recommendedIds(source, ADULT)).toEqual([explicitRock.id, commonRock.id]);
  });

  it("não entrega música com dislike da conta, com perfil ou sem histórico", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const dislikedRock = music({ genreIds: [ROCK], streams: 500 });
    const otherRock = music({ genreIds: [ROCK] });
    const source = makeSource(heardRock, dislikedRock, otherRock);
    source.dislikedByUser.set(ANA, [dislikedRock.id]);
    source.dislikedByUser.set(ANA + 1, [otherRock.id]);

    expect(await recommendedIds(source)).toEqual([heardRock.id, otherRock.id]);

    source.listenedByUser.set(ANA, [heardRock.id]);
    expect(await recommendedIds(source)).toEqual([otherRock.id]);
  });

  it("não entrega música removida", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const removedRock = music({ genreIds: [ROCK], isRemoved: true });
    const activeRock = music({ genreIds: [ROCK] });
    const source = makeSource(heardRock, removedRock, activeRock);

    expect(await recommendedIds(source)).not.toContain(removedRock.id);
    source.listenedByUser.set(ANA, [heardRock.id]);
    expect(await recommendedIds(source)).toEqual([activeRock.id]);
  });

  it("entrega no máximo RECOMMENDATION_COUNT músicas", async () => {
    const heardRock = music({ genreIds: [ROCK] });
    const rockMusics = Array.from({ length: RECOMMENDATION_COUNT + 5 }, () => music({ genreIds: [ROCK] }));
    const source = makeSource(heardRock, ...rockMusics);

    expect(await recommendedIds(source)).toHaveLength(RECOMMENDATION_COUNT);
    source.listenedByUser.set(ANA, [heardRock.id]);
    expect(await recommendedIds(source)).toHaveLength(RECOMMENDATION_COUNT);
  });

  it("devolve só os campos de exibição", async () => {
    const candidate = music({ genreIds: [ROCK], artists: [{ id: QUEEN, name: "Queen" }], streams: 3 });

    const [entry] = await new RecommendMusics(makeSource(candidate)).execute({ userId: ANA, ...ADULT });

    expect(entry).toEqual({ id: candidate.id, name: candidate.name, duration: 200, artists: [{ id: QUEEN, name: "Queen" }] });
  });
});
