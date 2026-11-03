import Joi from "joi";

// `:id` chega como texto; só dígitos, sem sinal nem zero à esquerda, e dentro do integer do Postgres.
export const playlistIdParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[1-9][0-9]*$/)
    .custom((value: string, helpers) => (Number(value) <= 2_147_483_647 ? value : helpers.error("number.max")))
    .required()
    .messages({
      "string.pattern.base": '"id" must be a positive integer',
      "number.max": '"id" is too large',
    }),
});
