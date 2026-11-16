import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { UserProfile } from "../ports/user-repository.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { InMemorySubscriptionRepository } from "../testing/in-memory-subscription-repository.ts";
import { InMemoryUserRepository } from "../testing/in-memory-user-repository.ts";
import { AddCollaborator, ListCollaborators, RemoveCollaborator } from "./playlist-collaborators.ts";

// HU-19: o dono (admin) gerencia os colaboradores; o colaborador só pode sair.

const ANA = 1;
const BRUNO = 2;
const CARLA = 3;
const DIEGO = 4;

function profile(id: number, name: string): UserProfile {
  return { id, name, birthdate: "1995-03-12", deletedAt: null };
}

async function setup({ isPrivate = false } = {}) {
  const playlists = new InMemoryPlaylistRepository();
  const users = new InMemoryUserRepository([
    { profile: profile(ANA, "Ana"), email: "ana@zovic.test" },
    { profile: profile(BRUNO, "Bruno"), email: "bruno@zovic.test" },
    { profile: profile(CARLA, "Carla"), email: "carla@zovic.test" },
    { profile: profile(DIEGO, "Diego"), email: "diego@zovic.test" },
  ]);
  // Ana, Bruno e Diego têm plano; Carla não
  const subscriptions = new InMemorySubscriptionRepository();
  for (const subscriberId of [ANA, BRUNO, DIEGO]) subscriptions.seedFamilyPlan(subscriberId, []);

  const playlist = Playlist.create({ id: await playlists.nextId(), creatorId: ANA, name: "Mar", isPrivate });
  await playlists.save(playlist);

  return {
    playlists,
    playlistId: playlist.id,
    list: new ListCollaborators(playlists, users),
    add: new AddCollaborator(playlists, users, subscriptions),
    remove: new RemoveCollaborator(playlists),
  };
}

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

describe("ListCollaborators", () => {
  it("lista o dono primeiro e os colaboradores pelo nome, sem email", async () => {
    const { list, add, playlistId } = await setup();
    await add.execute({ userId: ANA, playlistId, email: "diego@zovic.test" });
    await add.execute({ userId: ANA, playlistId, email: "bruno@zovic.test" });

    const collaborators = await list.execute({ userId: BRUNO, playlistId });

    expect(collaborators).toEqual([
      { userId: ANA, name: "Ana", isOwner: true },
      { userId: BRUNO, name: "Bruno", isOwner: false },
      { userId: DIEGO, name: "Diego", isOwner: false },
    ]);
  });

  it("esconde a playlist privada de quem não é membro", async () => {
    const { list, playlistId } = await setup({ isPrivate: true });

    expect(await failure(list.execute({ userId: CARLA, playlistId }))).toBeInstanceOf(NotFoundError);
  });
});

describe("AddCollaborator", () => {
  it("o dono adiciona um assinante pelo email", async () => {
    const { add, playlists, playlistId } = await setup();

    const collaborators = await add.execute({ userId: ANA, playlistId, email: "  Bruno@Zovic.test " });

    expect(collaborators).toContainEqual({ userId: BRUNO, name: "Bruno", isOwner: false });
    expect((await playlists.findById(playlistId))?.isMember(BRUNO)).toBe(true);
  });

  it("recusa quem não é dono com ForbiddenError", async () => {
    const { add, playlistId } = await setup();
    await add.execute({ userId: ANA, playlistId, email: "bruno@zovic.test" });

    expect(await failure(add.execute({ userId: BRUNO, playlistId, email: "diego@zovic.test" }))).toBeInstanceOf(ForbiddenError);
  });

  it("dá NotFoundError para email sem conta e para a privada de quem não é membro", async () => {
    const publica = await setup();
    const privada = await setup({ isPrivate: true });

    expect(await failure(publica.add.execute({ userId: ANA, playlistId: publica.playlistId, email: "ninguem@zovic.test" }))).toBeInstanceOf(
      NotFoundError,
    );
    expect(await failure(privada.add.execute({ userId: DIEGO, playlistId: privada.playlistId, email: "bruno@zovic.test" }))).toBeInstanceOf(
      NotFoundError,
    );
  });

  it("recusa conta sem assinatura ativa com BusinessRuleError", async () => {
    const { add, playlistId } = await setup();

    expect(await failure(add.execute({ userId: ANA, playlistId, email: "carla@zovic.test" }))).toBeInstanceOf(BusinessRuleError);
  });

  it("recusa quem já é membro com BusinessRuleError", async () => {
    const { add, playlistId } = await setup();
    await add.execute({ userId: ANA, playlistId, email: "bruno@zovic.test" });

    expect(await failure(add.execute({ userId: ANA, playlistId, email: "bruno@zovic.test" }))).toBeInstanceOf(BusinessRuleError);
    expect(await failure(add.execute({ userId: ANA, playlistId, email: "ana@zovic.test" }))).toBeInstanceOf(BusinessRuleError);
  });
});

describe("Colaboradores e gravações simultâneas", () => {
  it("salvar uma cópia antiga da playlist não desfaz quem entrou nem quem saiu", async () => {
    const { add, remove, playlists, playlistId } = await setup();
    await add.execute({ userId: ANA, playlistId, email: "bruno@zovic.test" });
    const staleCopy = (await playlists.findById(playlistId))!;

    await remove.execute({ userId: BRUNO, playlistId, collaboratorId: BRUNO });
    await add.execute({ userId: ANA, playlistId, email: "diego@zovic.test" });
    staleCopy.rename("Renomeada com cópia antiga");
    await playlists.save(staleCopy);

    const saved = (await playlists.findById(playlistId))!;
    expect(saved.isMember(BRUNO)).toBe(false);
    expect(saved.isMember(DIEGO)).toBe(true);
  });
});

describe("RemoveCollaborator", () => {
  async function withBrunoAndDiego() {
    const context = await setup();
    await context.add.execute({ userId: ANA, playlistId: context.playlistId, email: "bruno@zovic.test" });
    await context.add.execute({ userId: ANA, playlistId: context.playlistId, email: "diego@zovic.test" });
    return context;
  }

  it("o dono remove um colaborador", async () => {
    const { remove, playlists, playlistId } = await withBrunoAndDiego();

    await remove.execute({ userId: ANA, playlistId, collaboratorId: BRUNO });

    expect((await playlists.findById(playlistId))?.isMember(BRUNO)).toBe(false);
  });

  it("o colaborador sai da playlist", async () => {
    const { remove, playlists, playlistId } = await withBrunoAndDiego();

    await remove.execute({ userId: BRUNO, playlistId, collaboratorId: BRUNO });

    expect((await playlists.findById(playlistId))?.isMember(BRUNO)).toBe(false);
  });

  it("o colaborador não remove outro colaborador", async () => {
    const { remove, playlistId } = await withBrunoAndDiego();

    expect(await failure(remove.execute({ userId: BRUNO, playlistId, collaboratorId: DIEGO }))).toBeInstanceOf(ForbiddenError);
  });

  it("o dono não sai da própria playlist", async () => {
    const { remove, playlistId } = await withBrunoAndDiego();

    expect(await failure(remove.execute({ userId: ANA, playlistId, collaboratorId: ANA }))).toBeInstanceOf(BusinessRuleError);
  });

  it("dá NotFoundError para quem não é membro", async () => {
    const { remove, playlistId } = await withBrunoAndDiego();

    expect(await failure(remove.execute({ userId: ANA, playlistId, collaboratorId: CARLA }))).toBeInstanceOf(NotFoundError);
  });
});
