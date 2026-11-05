import type { RequestHandler } from "express";
import { invitationTokenParamsSchema } from "../schemas/subscription-schemas.ts";

/** Token malformado responde 404, igual a um convite inexistente: o front trata os dois como convite inválido. */
export const validateInvitationToken: RequestHandler = (req, res, next) => {
  const { error } = invitationTokenParamsSchema.validate(req.params);

  if (error) {
    res.status(404).json({ error: "NOT_FOUND", message: "Invitation not found" });
    return;
  }

  next();
};
