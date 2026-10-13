import type { RequestHandler } from "express";
import type { Schema } from "joi";

export function validateBody(schema: Schema): RequestHandler {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        fields: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
      return;
    }

    req.body = value;
    next();
  };
}
