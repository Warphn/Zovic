import Joi from "joi";
import { positiveIntParam } from "./playlist-id-params-schema.ts";

/** `/me/liked-musics/:id` (HU-34). */
export const likedMusicParamsSchema = Joi.object({ id: positiveIntParam("id") });
