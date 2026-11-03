import Joi from "joi";

const musicId = Joi.number().integer().min(1).max(2_147_483_647);

/** `POST /playlists/:id/musics`. */
export const addPlaylistMusicSchema = Joi.object({
  musicId: musicId.required(),
});

/** `PUT /playlists/:id/musics/order`: todas as músicas da playlist, na ordem nova (vazia na playlist vazia). */
export const reorderPlaylistMusicsSchema = Joi.object({
  musicIds: Joi.array().items(musicId).unique().max(10_000).required(),
});
