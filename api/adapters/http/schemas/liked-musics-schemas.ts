import Joi from "joi";
import { positiveIntParam } from "./playlist-id-params-schema.ts";

/** `/me/liked-musics/:id` (HU-34) e `/me/disliked-musics/:id` (HU-20). */
export const likedMusicParamsSchema = Joi.object({ id: positiveIntParam("id") });
