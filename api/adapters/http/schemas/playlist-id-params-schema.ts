import Joi from "joi";

// Parâmetro de rota chega como texto: só dígitos, sem sinal nem zero à esquerda, e dentro do integer do Postgres.
export const positiveIntParam = (name: string) =>
  Joi.string()
    .pattern(/^[1-9][0-9]*$/)
    // O Joi roda todas as regras (abortEarly: false): sem o teste de dígitos, "abc" daria também "is too large".
    .custom((value: string, helpers) =>
      !/^\d+$/.test(value) || Number(value) <= 2_147_483_647 ? value : helpers.error("number.max"),
    )
    .required()
    .messages({
      "string.pattern.base": `"${name}" must be a positive integer`,
      "number.max": `"${name}" is too large`,
    });

export const playlistIdParamsSchema = Joi.object({ id: positiveIntParam("id") });

/** `/playlists/:id/musics/:musicId`. */
export const playlistMusicParamsSchema = Joi.object({ id: positiveIntParam("id"), musicId: positiveIntParam("musicId") });
