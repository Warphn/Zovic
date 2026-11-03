import type { Pool } from "pg";
import { Music } from "../../domain/entities/music.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { MusicRepository } from "../../domain/ports/music-repository.ts";
import { inTransaction, type LinkTable, nextId, replaceLinks, translateConstraintError } from "./sql.ts";

const ARTISTS: LinkTable = { table: "artist_music", owner: "music_id", other: "artist_id" };
const GENRES: LinkTable = { table: "genre_music", owner: "music_id", other: "genre_id" };

interface MusicRow {
  id: number;
  name: string;
  duration: number;
  lyrics_id: number | null;
  streams: number;
  rating: number | null;
  created_at: Date;
  deleted_at: Date | null;
  artist_ids: number[];
  genre_ids: number[];
}

const SELECT_ACTIVE = `
  SELECT m.id, m.name, m.duration, m.lyrics_id, m.streams, m.rating, m.created_at, m.deleted_at,
    ARRAY(SELECT artist_id FROM artist_music WHERE music_id = m.id ORDER BY artist_id) AS artist_ids,
    ARRAY(SELECT genre_id FROM genre_music WHERE music_id = m.id ORDER BY genre_id) AS genre_ids
  FROM musics m
  WHERE m.id = ANY($1::integer[]) AND m.deleted_at IS NULL`;

export class PostgresMusicRepository implements MusicRepository {
  constructor(private readonly pool: Pool) {}

  nextId(): Promise<number> {
    return nextId(this.pool, "musics");
  }

  async save(music: Music): Promise<void> {
    const data = music.toData();
    try {
      await inTransaction(this.pool, async (client) => {
        // streams e rating são estatísticas: entram com o padrão do banco e o save não as altera.
        await client.query(
          `INSERT INTO musics (id, name, duration, lyrics_id, created_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             duration = EXCLUDED.duration,
             lyrics_id = EXCLUDED.lyrics_id,
             deleted_at = EXCLUDED.deleted_at`,
          [data.id, data.name, data.duration, data.lyricsId, data.createdAt, data.deletedAt],
        );
        await replaceLinks(client, ARTISTS, data.id, data.artistIds);
        await replaceLinks(client, GENRES, data.id, data.genreIds);
      });
    } catch (error) {
      throw translateConstraintError(error, {
        artist_music_artist_id_fkey: () => new NotFoundError("Artist not found"),
        genre_music_genre_id_fkey: () => new NotFoundError("Genre not found"),
      });
    }
  }

  async findById(id: number): Promise<Music | null> {
    const [music] = await this.findByIds([id]);
    return music ?? null;
  }

  async findByIds(ids: number[]): Promise<Music[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query<MusicRow>(SELECT_ACTIVE, [ids]);
    const byId = new Map(rows.map((row) => [row.id, toMusic(row)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
}

function toMusic(row: MusicRow): Music {
  return Music.restore({
    id: row.id,
    name: row.name,
    duration: row.duration,
    lyricsId: row.lyrics_id,
    streams: row.streams,
    rating: row.rating,
    artistIds: row.artist_ids,
    genreIds: row.genre_ids,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  });
}
