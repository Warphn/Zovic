import { describe, expect, it } from "bun:test";
import { Playlist } from "../entities/playlist.ts";
import { InMemoryPlaylistRepository } from "../testing/in-memory-playlist-repository.ts";
import { ListMyPlaylists } from "./list-my-playlists.ts";

const ANA = 1;
const BRUNO = 2;

async function seed(repository: InMemoryPlaylistRepository, creatorId: number, name: string, now: Date) {
  const playlist = Playlist.create({ id: await repository.nextId(), creatorId, name, now });
  await repository.save(playlist);
  return playlist;
}

describe("ListMyPlaylists", () => {
  it("lista só as playlists de que o usuário é membro, da mais nova para a mais antiga", async () => {
    const repository = new InMemoryPlaylistRepository();
    await seed(repository, ANA, "Antiga", new Date("2026-01-01T00:00:00Z"));
    await seed(repository, BRUNO, "Do Bruno", new Date("2026-01-02T00:00:00Z"));
    await seed(repository, ANA, "Nova", new Date("2026-01-03T00:00:00Z"));

    const output = await new ListMyPlaylists(repository).execute({ userId: ANA });

    expect(output.map((p) => p.name)).toEqual(["Nova", "Antiga"]);
  });

  it("deixa de fora as playlists apagadas", async () => {
    const repository = new InMemoryPlaylistRepository();
    const apagada = await seed(repository, ANA, "Apagada", new Date("2026-01-01T00:00:00Z"));
    apagada.delete();
    await repository.save(apagada);

    const output = await new ListMyPlaylists(repository).execute({ userId: ANA });

    expect(output).toEqual([]);
  });

  it("marca isAdmin conforme o papel do usuário em cada playlist", async () => {
    const repository = new InMemoryPlaylistRepository();
    const doBruno = await seed(repository, BRUNO, "Do Bruno", new Date("2026-01-01T00:00:00Z"));
    doBruno.addMember(ANA);
    await repository.save(doBruno);
    await seed(repository, ANA, "Da Ana", new Date("2026-01-02T00:00:00Z"));

    const output = await new ListMyPlaylists(repository).execute({ userId: ANA });

    expect(output.map((p) => [p.name, p.isAdmin])).toEqual([
      ["Da Ana", true],
      ["Do Bruno", false],
    ]);
  });
});
