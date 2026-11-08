import Joi from "joi";
import { INVITATION_TOKEN_MAX_LENGTH } from "../../../domain/shared/plan-invitation.ts";
import { EMAIL_MAX_LENGTH } from "../../auth/create-auth.ts";
import { positiveIntParam } from "./playlist-id-params-schema.ts";

export const subscribeSchema = Joi.object({
  kind: Joi.string().valid("individual", "family").default("individual"),
});

export const inviteSchema = Joi.object({
  // Sem lista de TLDs, como o cadastro (aceita domínios como .test do seed).
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(EMAIL_MAX_LENGTH).required(),
});

export const invitationIdParamsSchema = Joi.object({ id: positiveIntParam("id") });

export const memberIdParamsSchema = Joi.object({ userId: positiveIntParam("userId") });

export const invitationTokenParamsSchema = Joi.object({
  token: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .max(INVITATION_TOKEN_MAX_LENGTH)
    .required(),
});
