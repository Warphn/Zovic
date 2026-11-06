import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { Artist } from "../../domain/entities/artist.ts";
import { Music } from "../../domain/entities/music.ts";
import { Playlist } from "../../domain/entities/playlist.ts";
import { PostgresArtistRepository } from "./postgres-artist-repository.ts";
import { PostgresMusicRepository } from "./postgres-music-repository.ts";
import { PostgresPlaylistRepository } from "./postgres-playlist-repository.ts";
import { PostgresSearchQuery } from "./postgres-search-query.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const artists = new PostgresArtistRepository(pool);
const musics = new PostgresMusicRepository(pool);
const playlists = new PostgresPlaylistRepository(pool);
const query = new PostgresSearchQuery(pool);

// Só letras: um token por execução, para nada do seed nem de outra execução casar com as buscas.
const T = `qz${Date.now().toString(36).replace(/\d/g, (d) => "abcdefghij"[Number(d)]!)}`;
const created = { artist: [] as number[], musics: [] as number[], playlists: [] as number[], user: [] as number[] };
let viewer: number;
let stranger: number;

async function insertUser(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(`INSERT INTO "user" (name) VALUES ($1) RETURNING id`, [name]);
  created.user.push(rows[0]!.id);
  return rows[0]!.id;
}

async function artist(name: string, deleted = false): Promise<Artist> {
  const id = await artists.nextId();
  created.artist.push(id);
  const entity = Artist.create({ id, name });
  if (deleted) entity.delete();
  await artists.save(entity);
  return entity;
}

async function music(name: string, artistIds: number[], deleted = false): Promise<Music> {
  const id = await musics.nextId();
  created.musics.push(id);
  const entity = Music.create({ id, name, duration: 200, artistIds, genreIds: [], audioFile: "teste.mp3" });
  if (deleted) entity.delete();
  await musics.save(entity);
  return entity;
}

async function playlist(creatorId: number, name: string, options: { isPrivate?: boolean; deleted?: boolean } = {}) {
  const id = await playlists.nextId();
  created.playlists.push(id);
  const entity = Playlist.create({ id, creatorId, name, isPrivate: options.isPrivate ?? false });
  if (options.deleted) entity.delete();
  await playlists.save(entity);
  return entity;
}

async function addToPlaylist(playlistId: number, musicIds: number[]): Promise<void> {
  await pool.query(
    `INSERT INTO music_playlist (music_id, playlist_id, position)
     SELECT music_id, $2, ord - 1 FROM unnest($1::integer[]) WITH ORDINALITY AS t(music_id, ord)`,
    [musicIds, playlistId],
  );
}

const search = (term: string, limit = 10) => query.search({ term, viewerId: viewer, limit });
const names = (items: { name: string }[]) => items.map((item) => item.name);

beforeAll(async () => {
  viewer = await insertUser("Search viewer");
  stranger = await insertUser("Search stranger");
});

afterAll(async () => {
  // As associativas somem pelo ON DELETE CASCADE.
  for (const [table, ids] of Object.entries(created)) {
    await pool.query(`DELETE FROM "${table}" WHERE id = ANY($1::integer[])`, [ids]);
  }
  await pool.end();
});

describe("PostgresSearchQuery", () => {
  it("não diferencia maiúsculas nem acentos", async () => {
    await artist(`Água${T} Viva`);
    await artist(`ÇÃO${T}`);

    const semAcento = await search(`agua${T}`);
    const maiusculas = await search(`CAO${T}`);

    expect(names(semAcento.artists)).toEqual([`Água${T} Viva`]);
    expect(names(maiusculas.artists)).toEqual([`ÇÃO${T}`]);
  });

  it("ordena: começa com o termo, depois palavra que começa, depois no meio; empate em ordem alfabética", async () => {
    const term = `${T}rock`;
    await artist(`Indie ${term}`);
    await artist(`Ab${term}`);
    await artist(`${term} Zeta`);
    await artist(`${term} Alfa`);
    await artist(`Pós-${term}`);

    const { artists: found } = await search(term);

    expect(names(found)).toEqual([`${term} Alfa`, `${term} Zeta`, `Indie ${term}`, `Pós-${term}`, `Ab${term}`]);
  });

  it("trata % e _ como texto, não como curinga", async () => {
    await artist(`${T}curinga`);
    await artist(`${T}50% off`);

    expect(names((await search(`${T}%`)).artists)).toEqual([]);
    expect(names((await search(`${T}_uringa`)).artists)).toEqual([]);
    expect(names((await search(`${T}50%`)).artists)).toEqual([`${T}50% off`]);
  });

  it("acha música pelo nome dos artistas e devolve só os artistas ativos", async () => {
    const principal = await artist(`Banda${T}`);
    const convidado = await artist(`Convidado${T}`);
    const apagado = await artist(`Apagado${T}`, true);
    const faixa = await music("Canção qualquer", [convidado.id, principal.id, apagado.id]);

    const { musics: found } = await search(`banda${T}`);

    expect(found).toEqual([
      {
        id: faixa.id,
        name: "Canção qualquer",
        duration: 200,
        artists: [
          { id: principal.id, name: `Banda${T}` },
          { id: convidado.id, name: `Convidado${T}` },
        ],
      },
    ]);
  });

  it("conta só as músicas ativas do artista e deixa de fora o que foi apagado", async () => {
    const ativo = await artist(`Contado${T}`);
    await artist(`Contado${T} apagado`, true);
    await music(`Faixa${T} um`, [ativo.id]);
    await music(`Faixa${T} dois`, [ativo.id]);
    await music(`Faixa${T} apagada`, [ativo.id], true);

    const porArtista = await search(`contado${T}`);
    const porMusica = await search(`faixa${T}`);

    expect(porArtista.artists).toEqual([{ id: ativo.id, name: `Contado${T}`, musicCount: 2 }]);
    expect(names(porMusica.musics)).toEqual([`Faixa${T} dois`, `Faixa${T} um`]);
  });

  it("mostra playlists públicas de qualquer pessoa e privadas só de quem é membro", async () => {
    const term = `Lista${T}`;
    await playlist(stranger, `${term} pública de outro`);
    await playlist(stranger, `${term} privada de outro`, { isPrivate: true });
    await playlist(viewer, `${term} privada minha`, { isPrivate: true });
    await playlist(viewer, `${term} apagada`, { deleted: true });
    const compartilhada = await playlist(stranger, `${term} privada compartilhada`, { isPrivate: true });
    compartilhada.addMember(viewer);
    await playlists.save(compartilhada);

    const { playlists: found } = await search(term);

    expect(names(found)).toEqual([`${term} privada compartilhada`, `${term} privada minha`, `${term} pública de outro`]);
  });

  it("conta as músicas ativas da playlist", async () => {
    const dono = await artist(`Dono${T}`);
    const ativa = await music("Ativa", [dono.id]);
    const apagada = await music("Apagada", [dono.id], true);
    const lista = await playlist(viewer, `Contagem${T}`);
    await addToPlaylist(lista.id, [ativa.id, apagada.id]);

    const { playlists: found } = await search(`contagem${T}`);

    expect(found).toEqual([{ id: lista.id, name: `Contagem${T}`, isPrivate: false, color: null, musicCount: 1 }]);
  });

  it("respeita o limite em cada grupo", async () => {
    const term = `Limite${T}`;
    const dono = await artist(`${term} artista 1`);
    await artist(`${term} artista 2`);
    await music(`${term} música 1`, [dono.id]);
    await music(`${term} música 2`, [dono.id]);

    const result = await search(term, 1);

    expect(result.artists).toHaveLength(1);
    expect(result.musics).toHaveLength(1);
  });
});
