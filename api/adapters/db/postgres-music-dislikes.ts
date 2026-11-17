import type { Pool } from "pg";
import type { MusicDislikes } from "../../domain/ports/music-dislikes.ts";

const LIST_MUSIC_IDS = `
  SELECT music_id FROM music_dislikes WHERE user_id = $1 ORDER BY created_at DESC, music_id`;

// Um comando só, e só para música ativa e visível para quem pede. O ON CONFLICT faz o segundo
// dislike não mudar nada, e o resultado conta a música visível, então ele também é sucesso.
const ADD_DISLIKE = `
  WITH visible AS (
    SELECT id FROM musics WHERE id = $2 AND deleted_at IS NULL AND ($3 OR NOT is_explicit)
  ), inserted AS (
    INSERT INTO music_dislikes (user_id, music_id)
    SELECT $1, id FROM visible
    ON CONFLICT (user_id, music_id) DO NOTHING
  )
  SELECT 1 FROM visible`;

const REMOVE_DISLIKE = "DELETE FROM music_dislikes WHERE user_id = $1 AND music_id = $2";

export class PostgresMusicDislikes implements MusicDislikes {
  constructor(private readonly pool: Pool) {}

  async listMusicIds(userId: number): Promise<number[]> {
    const { rows } = await this.pool.query<{ music_id: number }>(LIST_MUSIC_IDS, [userId]);
    return rows.map((row) => row.music_id);
  }

  async add(userId: number, musicId: number, includeExplicit: boolean): Promise<boolean> {
    const { rowCount } = await this.pool.query(ADD_DISLIKE, [userId, musicId, includeExplicit]);
    return rowCount === 1;
  }

  async remove(userId: number, musicId: number): Promise<void> {
    await this.pool.query(REMOVE_DISLIKE, [userId, musicId]);
  }
}
