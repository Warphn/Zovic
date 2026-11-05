import type { RequestHandler } from "express";
import multer, { MulterError } from "multer";
import { MAX_AUDIO_BYTES } from "../../../domain/shared/audio.ts";

const parseMultipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
}).single("audio");

/**
 * Lê o multipart do cadastro de música: o arquivo da parte `audio` fica em memória
 * (`req.file.buffer`) e o texto das outras partes vai para `req.body`. O teto de tamanho
 * corta o upload no meio, antes de o arquivo inteiro chegar à memória; o formato (MP3)
 * é conferido depois, no domínio.
 *
 * Os erros do multer (tamanho, parte inesperada) seguem para o errorHandler. Os demais vêm
 * do parser (sem o separador das partes, corpo cortado no meio do envio) e são culpa da
 * requisição, não da API: viram 400.
 */
export const receiveAudio: RequestHandler = (req, res, next) => {
  parseMultipart(req, res, (error?: unknown) => {
    if (error === undefined || error instanceof MulterError) {
      next(error);
      return;
    }
    res.status(400).json({ error: "INVALID_UPLOAD", message: "Malformed multipart body" });
  });
};
