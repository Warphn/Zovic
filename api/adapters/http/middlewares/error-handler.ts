import type { ErrorRequestHandler } from "express";
import {
  BusinessRuleError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../domain/errors/domain-error.ts";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    res.status(statusFor(err)).json({ error: err.code, message: err.message });
    return;
  }

  if (isMalformedJson(err)) {
    res.status(400).json({ error: "INVALID_JSON", message: "Request body is not valid JSON" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
};

function statusFor(error: DomainError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof BusinessRuleError) return 409;
  return 400;
}

function isMalformedJson(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}
