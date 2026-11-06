import type { RequestHandler } from "express";
import multer, { MulterError } from "multer";
import { MAX_AUDIO_BYTES } from "../../../domain/shared/audio.ts";
import { MAX_COVER_BYTES } from "../../../domain/shared/cover-image.ts";

interface FileUpload {
  /** A parte do multipart que leva o arquivo. */
  field: string;
  maxBytes: number;
  /** A resposta 413, que diz qual arquivo passou do limite. */
  tooLarge: { error: string; message: string };
}

/**
 * Lê um multipart com um arquivo: ele fica em memória (`req.file.buffer`) e o texto das outras
 * partes vai para `req.body`. O teto de tamanho corta o upload no meio, antes de o arquivo inteiro
 * chegar à memória; o formato é conferido depois, no domínio.
 *
 * Todo erro de leitura é culpa da requisição, não da API: acima do teto, 413; arquivo numa parte
 * inesperada ou mais de um arquivo (erros do multer), e multipart malformado (sem o separador das
 * partes, corpo cortado no meio do envio), 400.
 */
function receiveFile({ field, maxBytes, tooLarge }: FileUpload): RequestHandler {
  const parseMultipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single(field);
  return (req, res, next) => {
    parseMultipart(req, res, (error?: unknown) => {
      if (error === undefined) {
        next();
      } else if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json(tooLarge);
      } else if (error instanceof MulterError) {
        res.status(400).json({ error: "INVALID_UPLOAD", message: error.message });
      } else {
        res.status(400).json({ error: "INVALID_UPLOAD", message: "Malformed multipart body" });
      }
    });
  };
}

/** O MP3 da parte `audio`, no cadastro de música. */
export const receiveAudio = receiveFile({
  field: "audio",
  maxBytes: MAX_AUDIO_BYTES,
  tooLarge: { error: "AUDIO_TOO_LARGE", message: "Audio file must be at most 20 MB" },
});

/** A imagem da parte `cover`, no cadastro e na troca de capa do álbum. */
export const receiveCover = receiveFile({
  field: "cover",
  maxBytes: MAX_COVER_BYTES,
  tooLarge: { error: "COVER_TOO_LARGE", message: "Cover image must be at most 2 MB" },
});
