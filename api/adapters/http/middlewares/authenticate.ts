import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../../auth/create-auth.ts";

declare global {
  namespace Express {
    interface Locals {
      userId: number;
    }
  }
}

export function makeAuthenticate(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });

    // Na renovação deslizante o Better Auth devolve o cookie com a validade nova.
    for (const cookie of headers.getSetCookie()) {
      res.append("Set-Cookie", cookie);
    }

    // Soft delete: sessões que já existiam antes da remoção do usuário também deixam de valer.
    const userId = Number(response?.user.id);
    if (!response || response.user.deletedAt || !Number.isInteger(userId)) {
      res.status(401).json({ error: "UNAUTHENTICATED", message: "Authentication required" });
      return;
    }

    res.locals.userId = userId;
    next();
  };
}
