import type { NextFunction, Response } from "express";
import { NotFoundError } from "../../domain/errors/domain-error.ts";

/**
 * As imagens: a URL muda a cada troca (?v=), mas quem pede sem a versão também precisa ver a nova
 * logo. Vale para as capas dos álbuns e das playlists e para as fotos dos artistas.
 */
export const IMAGE_CACHE_CONTROL = "private, max-age=86400";

/**
 * Entrega um arquivo do armazenamento. O sendFile define o Content-Type pela extensão e responde a
 * Range (206); um arquivo que sumiu do disco vira 404 com `notFoundMessage`.
 */
export function sendStoredFile(
  res: Response,
  next: NextFunction,
  { path, cacheControl, notFoundMessage }: { path: string; cacheControl: string; notFoundMessage: string },
): void {
  res.set("Cache-Control", cacheControl);
  res.sendFile(path, (error) => {
    // Com os cabeçalhos já enviados, o erro é o navegador cancelando o download: não há o que responder.
    if (error && !res.headersSent) next(new NotFoundError(notFoundMessage));
  });
}
