import type { RequestHandler, Response } from "express";
import type { Schema, ValidationError } from "joi";

/** Valida o corpo; o valor limpo (trim, campos fora do schema descartados) substitui `req.body`. */
export function validateBody(schema: Schema): RequestHandler {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      sendValidationError(res, error);
      return;
    }

    req.body = value;
    next();
  };
}

/**
 * Valida os parâmetros da rota. Eles continuam strings em `req.params`: o controller converte
 * depois de validados (por exemplo, `Number(req.params.id)`).
 */
export function validateParams(schema: Schema): RequestHandler {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      sendValidationError(res, error);
      return;
    }

    next();
  };
}

function sendValidationError(res: Response, error: ValidationError): void {
  res.status(400).json({
    error: "VALIDATION_ERROR",
    fields: error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    })),
  });
}
