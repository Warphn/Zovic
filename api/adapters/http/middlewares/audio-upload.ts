import multer from "multer";
import { MAX_AUDIO_BYTES } from "../../../domain/shared/audio.ts";

/**
 * Lê o multipart do cadastro de música: o arquivo da parte `audio` fica em memória
 * (`req.file.buffer`) e o texto das outras partes vai para `req.body`. O teto de tamanho
 * corta o upload no meio, antes de o arquivo inteiro chegar à memória; o formato (MP3)
 * é conferido depois, no domínio.
 */
export const receiveAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
}).single("audio");
