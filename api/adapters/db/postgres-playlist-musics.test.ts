import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Album } from "../../domain/entities/album.ts";
import { Artist } from "../../domain/entities/artist.ts";
import { Music } from "../../domain/entities/music.ts";
import { Playlist } from "../../domain/entities/playlist.ts";
import { PostgresAlbumRepository } from "./postgres-album-repository.ts";
import { PostgresArtistRepository } from "./postgres-artist-repository.ts";
import { PostgresMusicRepository } from "./postgres-music-repository.ts";
import { PostgresPlaylistMusics } from "./postgres-playlist-musics.ts";
import { PostgresPlaylistRepository } from "./postgres-playlist-repository.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const artists = new PostgresArtistRepository(pool);
const albums = new PostgresAlbumRepository(pool);
const musics = new PostgresMusicRepository(pool);
const playlists = new PostgresPlaylistRepository(pool);
const playlistMusics = new PostgresPlaylistMusics(pool);

// Quem pode ver as músicas explícitas (maior de idade) e quem não pode (menor).
const ADULT_VIEW = true;
const MINOR_VIEW = false;

const created = { album: [] as number[], artist: [] as number[], musics: [] as number[], playlists: [] as number[] };
let userId: number;
let artistId: number;

async function artist(name: string, deleted = false): Promise<Artist> {
  const id = await artists.nextId();
  created.artist.push(id);
  const entity = Artist.create({ id, name });
  if (deleted) entity.delete();
  await artists.save(entity);
  return entity;
}

async function music(name: string, options: { artistIds?: number[]; deleted?: boolean; isExplicit?: boolean } = {}): Promise<number> {
  const id = await musics.nextId();
  created.musics.push(id);
  const entity = Music.create({
    id,
    name,
    duration: 180,
    artistIds: options.artistIds ?? [artistId],
    audioFile: "teste.mp3",
    isExplicit: options.isExplicit ?? false,
  });
  if (options.deleted) entity.delete();
  await musics.save(entity);
  return id;
}

async function album(name: string, musicIds: number[], deleted = false): Promise<number> {
  const id = await albums.nextId();
  created.album.push(id);
  const entity = Album.create({ id, name, artistIds: [artistId], year: 2000, coverFile: "capa.png" });
  if (deleted) entity.delete();
  await albums.save(entity);
  // Uma música em vários álbuns só existe nos dados antigos (o domínio limita a um), por isso
  // o vínculo entra direto no banco: é ele que a regra do "álbum ativo de menor id" cobre.
  await pool.query("INSERT INTO album_music (album_id, music_id) SELECT $1, unnest($2::integer[])", [id, musicIds]);
  return id;
}

async function newPlaylist(): Promise<number> {
  const id = await playlists.nextId();
  created.playlists.push(id);
  await playlists.save(Playlist.create({ id, creatorId: userId, name: "Integração" }));
  return id;
}

/** Cria a playlist e põe as músicas nela, nessa ordem. */
async function playlistWith(...musicIds: number[]): Promise<number> {
  const playlistId = await newPlaylist();
  for (const musicId of musicIds) expect(await playlistMusics.add(playlistId, musicId, ADULT_VIEW)).toBe("added");
  return playlistId;
}

const listIds = async (playlistId: number, includeExplicit = ADULT_VIEW) => (await playlistMusics.list(playlistId, includeExplicit)).map((item) => item.id);

async function positions(playlistId: number) {
  const { rows } = await pool.query<{ music_id: number; position: number }>(
    "SELECT music_id, position FROM music_playlist WHERE playlist_id = $1 ORDER BY position",
    [playlistId],
  );
  return rows.map((row) => [row.music_id, row.position]);
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: number }>(`INSERT INTO "user" (name) VALUES ('Playlist musics') RETURNING id`);
  userId = rows[0]!.id;
  artistId = (await artist("Integração artista")).id;
});

afterAll(async () => {
  // music_playlist, artist_music e album_music somem pelo ON DELETE CASCADE.
  for (const [table, ids] of Object.entries(created)) {
    await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::integer[])`, [ids]);
  }
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  await pool.end();
});

describe("PostgresPlaylistMusics", () => {
  it("põe cada música no fim e lista na ordem em que entraram", async () => {
    const [a, b, c] = [await music("A"), await music("B"), await music("C")];

    const playlistId = await playlistWith(b, c, a);

    expect(await listIds(playlistId)).toEqual([b, c, a]);
    expect(await positions(playlistId)).toEqual([
      [b, 0],
      [c, 1],
      [a, 2],
    ]);
  });

  it("devolve artistas ativos em ordem alfabética, o primeiro álbum ativo e a data de entrada", async () => {
    const zeta = await artist("Zeta");
    const alfa = await artist("Alfa");
    const apagado = await artist("Apagado", true);
    const faixa = await music("Faixa", { artistIds: [zeta.id, alfa.id, apagado.id] });
    await album("Apagado", [faixa], true);
    const primeiro = await album("Primeiro", [faixa]);
    await album("Segundo", [faixa]);
    const semAlbum = await music("Sem álbum");
    const playlistId = await newPlaylist();
    await playlistMusics.add(playlistId, faixa, ADULT_VIEW, new Date("2026-11-01T12:00:00Z"));
    await playlistMusics.add(playlistId, semAlbum, ADULT_VIEW);

    const [comAlbum, avulsa] = await playlistMusics.list(playlistId, ADULT_VIEW);

    expect(comAlbum).toEqual({
      id: faixa,
      name: "Faixa",
      duration: 180,
      artists: [
        { id: alfa.id, name: "Alfa" },
        { id: zeta.id, name: "Zeta" },
      ],
      album: { id: primeiro, name: "Primeiro" },
      addedAt: "2026-11-01T12:00:00.000Z",
    });
    expect(avulsa?.album).toBeNull();
  });

  it("deixa de fora as músicas apagadas", async () => {
    const ativa = await music("Ativa");
    const apagada = await music("Vai ser apagada");
    const playlistId = await playlistWith(ativa, apagada);
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [apagada]);

    expect(await listIds(playlistId)).toEqual([ativa]);
  });

  it("não põe música inexistente, apagada ou repetida", async () => {
    const ativa = await music("Ativa");
    const apagada = await music("Apagada", { deleted: true });
    const playlistId = await playlistWith(ativa);

    expect(await playlistMusics.add(playlistId, 2_000_000_000, ADULT_VIEW)).toBe("music_not_found");
    expect(await playlistMusics.add(playlistId, apagada, ADULT_VIEW)).toBe("music_not_found");
    expect(await playlistMusics.add(playlistId, ativa, ADULT_VIEW)).toBe("already_in_playlist");
    expect(await listIds(playlistId)).toEqual([ativa]);
  });

  it("tira a música, deixa o buraco na posição e o próximo a entrar vai depois do último", async () => {
    const [a, b, c] = [await music("A"), await music("B"), await music("C")];
    const playlistId = await playlistWith(a, b);

    expect(await playlistMusics.remove(playlistId, a, ADULT_VIEW)).toBe(true);
    expect(await playlistMusics.remove(playlistId, a, ADULT_VIEW)).toBe(false);
    await playlistMusics.add(playlistId, c, ADULT_VIEW);

    expect(await positions(playlistId)).toEqual([
      [b, 1],
      [c, 2],
    ]);
  });

  it("reordena renumerando de 0 e põe as apagadas no fim, na ordem em que estavam", async () => {
    const [a, b, c, d] = [await music("A"), await music("B"), await music("C"), await music("D")];
    const playlistId = await playlistWith(a, b, c, d);
    await playlistMusics.remove(playlistId, a, ADULT_VIEW);
    await pool.query("UPDATE musics SET deleted_at = now() WHERE id = $1", [c]);

    expect(await playlistMusics.reorder(playlistId, [d, b], ADULT_VIEW)).toBe(true);

    expect(await listIds(playlistId)).toEqual([d, b]);
    expect(await positions(playlistId)).toEqual([
      [d, 0],
      [b, 1],
      [c, 2],
    ]);
  });

  it("recusa a lista que não tem exatamente as músicas ativas, sem mudar nada", async () => {
    const [a, b, c] = [await music("A"), await music("B"), await music("C")];
    const playlistId = await playlistWith(a, b);

    for (const ids of [[b], [b, a, c], [b, c], [a, a]]) {
      expect(await playlistMusics.reorder(playlistId, ids, ADULT_VIEW)).toBe(false);
    }
    expect(await listIds(playlistId)).toEqual([a, b]);
  });

  it("aceita lista vazia na playlist vazia e serializa inclusões simultâneas", async () => {
    const playlistId = await newPlaylist();
    expect(await playlistMusics.reorder(playlistId, [], ADULT_VIEW)).toBe(true);
    const ids = await Promise.all(["A", "B", "C", "D", "E"].map((name) => music(name)));

    const results = await Promise.all(ids.map((id) => playlistMusics.add(playlistId, id, ADULT_VIEW)));

    expect(results).toEqual(["added", "added", "added", "added", "added"]);
    expect((await positions(playlistId)).map(([, position]) => position)).toEqual([0, 1, 2, 3, 4]);
  });

  describe("músicas explícitas (HU-09)", () => {
    it("esconde a explícita da lista de quem não pode vê-la", async () => {
      const [comum, explicita] = [await music("Comum"), await music("Explícita", { isExplicit: true })];
      const playlistId = await playlistWith(explicita, comum);

      expect(await listIds(playlistId, MINOR_VIEW)).toEqual([comum]);
      expect(await listIds(playlistId, ADULT_VIEW)).toEqual([explicita, comum]);
    });

    it("não deixa quem não pode ver incluir a explícita", async () => {
      const explicita = await music("Explícita", { isExplicit: true });
      const playlistId = await newPlaylist();

      expect(await playlistMusics.add(playlistId, explicita, MINOR_VIEW)).toBe("music_not_found");
      expect(await listIds(playlistId)).toEqual([]);
    });

    it("não deixa quem não pode ver remover a explícita", async () => {
      const explicita = await music("Explícita", { isExplicit: true });
      const playlistId = await playlistWith(explicita);

      expect(await playlistMusics.remove(playlistId, explicita, MINOR_VIEW)).toBe(false);
      expect(await listIds(playlistId)).toEqual([explicita]);
    });

    it("reordena só as visíveis para quem não pode ver e manda a explícita para o fim", async () => {
      const [a, explicita, b] = [await music("A"), await music("Explícita", { isExplicit: true }), await music("B")];
      const playlistId = await playlistWith(a, explicita, b);

      expect(await playlistMusics.reorder(playlistId, [a, explicita, b], MINOR_VIEW)).toBe(false);
      expect(await playlistMusics.reorder(playlistId, [b, a], MINOR_VIEW)).toBe(true);

      expect(await positions(playlistId)).toEqual([
        [b, 0],
        [a, 1],
        [explicita, 2],
      ]);
    });
  });
});
