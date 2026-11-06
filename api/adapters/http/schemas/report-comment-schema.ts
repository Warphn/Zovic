import Joi from "joi";

export const reportCommentSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(280).required(),
});

