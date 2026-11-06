import type { RequestHandler, Response } from "express";
import type { Schema, ValidationError } from "joi";

declare global {
  namespace Express {
    interface Locals {
      /** A query string validada por `validateQuery`, já convertida e com os padrões aplicados. */
      query: Record<string, unknown>;
    }
  }
}

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
 * Valida a parte `data` de um multipart: um texto JSON com os campos, que o multipart não
 * representa como objeto. Sem a parte, valida um objeto vazio (os campos obrigatórios acusam).
 */
export function validateMultipartData(schema: Schema): RequestHandler {
  return (req, res, next) => {
    const data: unknown = req.body?.data;
    let fields: unknown = {};
    if (typeof data === "string") {
      try {
        fields = JSON.parse(data);
      } catch {
        res.status(400).json({ error: "INVALID_JSON", message: "The data part is not valid JSON" });
        return;
      }
    }
    req.body = fields;
    validateBody(schema)(req, res, next);
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

/**
 * Valida a query string. No Express 5 `req.query` é só leitura, então o valor limpo (trim,
 * números convertidos, padrões aplicados, chaves fora do schema descartadas) vai para `res.locals.query`.
 */
export function validateQuery(schema: Schema): RequestHandler {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });

    if (error) {
      sendValidationError(res, error);
      return;
    }

    res.locals.query = value;
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
