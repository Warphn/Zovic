import Joi from "joi";
import { EMAIL_MAX_LENGTH } from "../../auth/create-auth.ts";
import { positiveIntParam } from "./playlist-id-params-schema.ts";

/**
 * O email de quem entra como colaborador (HU-19); a conta e a assinatura são conferidas no domínio.
 * Sem lista de TLDs, como os outros emails da API: `.test` é o domínio das contas do seed.
 */
export const addCollaboratorSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(EMAIL_MAX_LENGTH).required(),
});

/** `/playlists/:id/collaborators/:userId`. */
export const playlistCollaboratorParamsSchema = Joi.object({ id: positiveIntParam("id"), userId: positiveIntParam("userId") });
