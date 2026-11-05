import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../../auth/create-auth.ts";

/** Papel global na plataforma (coluna user.role). */
export type PlatformRole = "admin" | "assinante";

declare global {
  namespace Express {
    interface Locals {
      userId: number;
      /** Email da conta, como está no banco. */
      email: string;
      role: PlatformRole;
      /** "AAAA-MM-DD", ou null se a conta não tem data de nascimento. */
      birthdate: string | null;
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
    res.locals.email = response.user.email;
    // Qualquer valor desconhecido vale como assinante.
    res.locals.role = response.user.role === "admin" ? "admin" : "assinante";
    res.locals.birthdate = toCalendarDate(response.user.birthdate);
    next();
  };
}

// O pool de produção já devolve colunas `date` como texto; um pool com o parser padrão do pg
// devolveria um Date à meia-noite do fuso do servidor, então lemos o dia pelos campos locais.
function toCalendarDate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${String(value.getFullYear()).padStart(4, "0")}-${month}-${day}`;
  }
  return null;
}
