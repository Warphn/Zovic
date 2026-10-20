import Joi from "joi";

export const createCommentSchema = Joi.object({
  comment: Joi.string().trim().min(1).max(280).required(),
  timestamp: Joi.number().integer().min(0).allow(null).optional(),
});

