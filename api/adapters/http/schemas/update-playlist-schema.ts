import Joi from "joi";
import { Playlist } from "../../../domain/entities/playlist.ts";
import { HEX_COLOR_PATTERN } from "../../../domain/shared/hex-color.ts";

// Mesmos campos da criação, todos opcionais; pelo menos um precisa vir. `color: null` apaga a cor.
export const updatePlaylistSchema = Joi.object({
  name: Joi.string().trim().min(1).max(Playlist.MAX_NAME_LENGTH),
  isPrivate: Joi.boolean(),
  color: Joi.string().trim().pattern(HEX_COLOR_PATTERN).allow(null),
})
  .min(1)
  .messages({ "object.min": "Send at least one of name, isPrivate or color" });
