import type { RequestHandler } from "express";

/**
 * Só deixa passar admins da plataforma (user.role = 'admin'). Vai depois do authenticate,
 * que preenche res.locals.role. Não tem relação com o is_admin de planos e playlists.
 */
export const requirePlatformAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "Platform admin role required" });
    return;
  }
  next();
};
