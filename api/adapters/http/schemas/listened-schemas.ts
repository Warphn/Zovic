import Joi from "joi";
import { positiveIntParam } from "./playlist-id-params-schema.ts";

/** `/musics/:id/listens`. */
export const musicIdParamsSchema = Joi.object({ id: positiveIntParam("id") });

/** Os segundos de som da reprodução, contados pelo player; a regra dos 30 segundos fica no domínio. */
export const markListenedSchema = Joi.object({
  playedSeconds: Joi.number().min(0).required(),
});
