import Joi from "joi";
import { Playlist } from "../../../domain/entities/playlist.ts";
import { HEX_COLOR_PATTERN } from "../../../domain/shared/hex-color.ts";

export const createPlaylistSchema = Joi.object({
  name: Joi.string().trim().min(1).max(Playlist.MAX_NAME_LENGTH).required(),
  isPrivate: Joi.boolean(),
  color: Joi.string().trim().pattern(HEX_COLOR_PATTERN).allow(null),
});
