import { ValidationError } from "../errors/domain-error.ts";

/** Tamanho máximo do arquivo de áudio de uma música: 20 MB. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const ID3_TAG = [0x49, 0x44, 0x33];
const FRAME_SYNC_FIRST_BYTE = 0xff;
const FRAME_SYNC_SECOND_BYTE_MASK = 0xe0;

/**
 * Confere pelos primeiros bytes, sem confiar na extensão nem no Content-Type, que o
 * cliente escolhe: um MP3 começa com a tag ID3 ou com o sincronismo de quadro MPEG
 * (11 bits ligados).
 */
export function isMp3(bytes: Uint8Array): boolean {
  const hasId3Tag = ID3_TAG.every((byte, index) => bytes[index] === byte);
  const hasFrameSync =
    bytes[0] === FRAME_SYNC_FIRST_BYTE &&
    bytes.length > 1 &&
    (bytes[1]! & FRAME_SYNC_SECOND_BYTE_MASK) === FRAME_SYNC_SECOND_BYTE_MASK;
  return hasId3Tag || hasFrameSync;
}

export function validateAudio(bytes: Uint8Array | null): asserts bytes is Uint8Array {
  if (bytes === null || bytes.length === 0) {
    throw new ValidationError("Music must have an audio file");
  }
  if (bytes.length > MAX_AUDIO_BYTES) {
    throw new ValidationError("Audio file must be at most 20 MB");
  }
  if (!isMp3(bytes)) {
    throw new ValidationError("Audio file must be an MP3");
  }
}
