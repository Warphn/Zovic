import { Playlist } from "../entities/playlist.ts";
import { NotFoundError } from "../errors/domain-error.ts";
import type { PlaylistMusics } from "../ports/playlist-musics.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";

// Músicas Curtidas (HU-34): a playlist fixa de cada conta, que a curtida alimenta. A curtida em si
// é da HU-20; quando ela for para a API, o voto chama LikeMusic e UnlikeMusic.

/** A Músicas Curtidas só muda pela curtida: o menu e a reordenação a recusam. */
export const LIKED_SONGS_ONLY_THROUGH_LIKES = "Músicas Curtidas only changes through likes";

export interface EnsureLikedSongsInput {
  userId: number;
}

export interface EnsureLikedSongsUseCase {
  execute(input: EnsureLikedSongsInput): Promise<Playlist>;
}

/** Acha a Músicas Curtidas da conta ou a cria: contas antigas e do seed a ganham na primeira vez. */
export class EnsureLikedSongs implements EnsureLikedSongsUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute({ userId }: EnsureLikedSongsInput): Promise<Playlist> {
    const existing = await this.playlists.findLikedSongs(userId);
    if (existing) return existing;
    const likedSongs = Playlist.createLikedSongs({ id: await this.playlists.nextId(), userId });
    return this.playlists.createLikedSongs(likedSongs);
  }
}

export interface LikedMusicInput {
  userId: number;
  musicId: number;
  now?: Date;
}

export interface LikeMusicUseCase {
  execute(input: LikedMusicInput): Promise<void>;
}

/** Põe a música curtida no topo da Músicas Curtidas. Curtir de novo não muda nada. */
export class LikeMusic implements LikeMusicUseCase {
  constructor(
    private readonly ensureLikedSongs: EnsureLikedSongsUseCase,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute({ userId, musicId, now }: LikedMusicInput): Promise<void> {
    const likedSongs = await this.ensureLikedSongs.execute({ userId });
    const result = await this.musics.addToTop(likedSongs.id, musicId, now);
    if (result === "music_not_found") throw new NotFoundError("Music not found");
  }
}

export interface UnlikeMusicUseCase {
  execute(input: LikedMusicInput): Promise<void>;
}

/** Tira a música da Músicas Curtidas. Descurtir o que não está lá não é erro. */
export class UnlikeMusic implements UnlikeMusicUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly musics: PlaylistMusics,
  ) {}

  async execute({ userId, musicId }: LikedMusicInput): Promise<void> {
    const likedSongs = await this.playlists.findLikedSongs(userId);
    // Descurtir sempre funciona, mesmo a explícita que a conta não vê mais (HU-09).
    if (likedSongs) await this.musics.remove(likedSongs.id, musicId, true);
  }
}
