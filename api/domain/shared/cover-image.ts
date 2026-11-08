import { ValidationError } from "../errors/domain-error.ts";

/** Tamanho máximo da imagem de capa de um álbum: 2 MB. */
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

export type CoverImageType = "jpeg" | "png" | "webp";

/** A extensão com que cada tipo é guardado, e por onde a rota da capa descobre o Content-Type. */
export const COVER_EXTENSIONS: Record<CoverImageType, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" };

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
/** No WebP, "WEBP" vem depois de "RIFF" e de 4 bytes com o tamanho do arquivo. */
const WEBP_SIGNATURE_OFFSET = 8;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** O tipo pelos primeiros bytes, sem confiar na extensão nem no Content-Type, que o cliente escolhe. */
export function coverImageType(bytes: Uint8Array): CoverImageType | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, WEBP_SIGNATURE_OFFSET)) return "webp";
  return null;
}

/** Confere a capa e devolve a extensão com que ela deve ser guardada. */
export function validateCover(bytes: Uint8Array | null): string {
  if (bytes === null || bytes.length === 0) {
    throw new ValidationError("Album must have a cover image");
  }
  if (bytes.length > MAX_COVER_BYTES) {
    throw new ValidationError("Cover image must be at most 2 MB");
  }
  const type = coverImageType(bytes);
  if (type === null) {
    throw new ValidationError("Cover image must be a JPEG, PNG or WebP");
  }
  return COVER_EXTENSIONS[type];
}
