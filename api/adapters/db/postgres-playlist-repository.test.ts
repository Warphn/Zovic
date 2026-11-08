import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Playlist } from "../../domain/entities/playlist.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import { PostgresPlaylistRepository } from "./postgres-playlist-repository.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repository = new PostgresPlaylistRepository(pool);
const createdPlaylistIds: number[] = [];
let userId: number;
let otherUserId: number;

async function insertUser(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO "user" (name) VALUES ($1) RETURNING id`,
    [name],
  );
  return rows[0]!.id;
}

async function newPlaylist(creatorId: number, name = "Integration", now?: Date): Promise<Playlist> {
  const id = await repository.nextId();
  createdPlaylistIds.push(id);
  return Playlist.create({ id, creatorId, name, color: "#ff8800", now });
}

async function countPlaylists(id: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*) FROM playlists WHERE id = $1",
    [id],
  );
  return Number(rows[0]!.count);
}

async function members(playlistId: number) {
  const { rows } = await pool.query<{ user_id: number; is_admin: boolean }>(
    "SELECT user_id, is_admin FROM playlist_user WHERE playlist_id = $1 ORDER BY user_id",
    [playlistId],
  );
  return rows;
}

beforeAll(async () => {
  userId = await insertUser("Integration test");
  otherUserId = await insertUser("Integration test 2");
});

afterAll(async () => {
  await pool.query("DELETE FROM playlists WHERE id = ANY($1::integer[])", [createdPlaylistIds]);
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::integer[])`, [[userId, otherUserId]]);
  await pool.end();
});

describe("PostgresPlaylistRepository", () => {
  it("grava a playlist e o criador como admin", async () => {
    const playlist = await newPlaylist(userId);

    await repository.save(playlist);

    const { rows } = await pool.query(
      "SELECT name, is_private, color, deleted_at FROM playlists WHERE id = $1",
      [playlist.id],
    );
    expect(rows[0]).toEqual({ name: "Integration", is_private: false, color: "#FF8800", deleted_at: null });
    expect(await members(playlist.id)).toEqual([{ user_id: userId, is_admin: true }]);
  });

  it("atualiza a playlist e regrava os membros ao salvar de novo", async () => {
    const playlist = await newPlaylist(userId);
    await repository.save(playlist);

    playlist.rename("Renamed");
    playlist.addMember(otherUserId);
    await repository.save(playlist);

    expect(await countPlaylists(playlist.id)).toBe(1);
    expect(await members(playlist.id)).toEqual([
      { user_id: userId, is_admin: true },
      { user_id: otherUserId, is_admin: false },
    ]);
  });

  it("traduz usuário inexistente em NotFoundError sem deixar playlist órfã", async () => {
    const playlist = await newPlaylist(2_000_000_000);

    const error = await repository.save(playlist).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(await countPlaylists(playlist.id)).toBe(0);
  });

  it("findById devolve a playlist com os membros e o papel de cada um", async () => {
    const playlist = await newPlaylist(userId, "Com membros", new Date("2026-01-01T12:00:00Z"));
    playlist.addMember(otherUserId);
    await repository.save(playlist);

    const found = await repository.findById(playlist.id);

    expect(found?.toData()).toEqual({
      id: playlist.id,
      name: "Com membros",
      isPrivate: false,
      color: "#FF8800",
      members: [
        { userId, isAdmin: true },
        { userId: otherUserId, isAdmin: false },
      ],
      createdAt: new Date("2026-01-01T12:00:00Z"),
      deletedAt: null,
    });
  });

  it("findById e listByUser ignoram playlists apagadas", async () => {
    const playlist = await newPlaylist(userId, "Apagada");
    playlist.delete();
    await repository.save(playlist);

    expect(await repository.findById(playlist.id)).toBeNull();
    expect((await repository.listByUser(userId)).map((p) => p.id)).not.toContain(playlist.id);
  });

  it("listByUser traz só as playlists do usuário, da mais nova para a mais antiga", async () => {
    const antiga = await newPlaylist(otherUserId, "Antiga", new Date("2025-01-01T00:00:00Z"));
    const nova = await newPlaylist(otherUserId, "Nova", new Date("2025-06-01T00:00:00Z"));
    const deOutro = await newPlaylist(userId, "De outro", new Date("2025-03-01T00:00:00Z"));
    await repository.save(antiga);
    await repository.save(nova);
    await repository.save(deOutro);

    const ids = (await repository.listByUser(otherUserId)).map((p) => p.id);

    expect(ids.indexOf(nova.id)).toBeLessThan(ids.indexOf(antiga.id));
    expect(ids).toContain(antiga.id);
    expect(ids).not.toContain(deOutro.id);
  });
});
