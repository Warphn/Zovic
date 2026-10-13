import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Locals {
      userId: number;
    }
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  const userId = Number(req.header("x-user-id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Missing or invalid x-user-id header" });
    return;
  }

  res.locals.userId = userId;
  next();
};
