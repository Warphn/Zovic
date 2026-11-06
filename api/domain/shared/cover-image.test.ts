import { describe, expect, it } from "bun:test";
import { ValidationError } from "../errors/domain-error.ts";
import { coverImageType, MAX_COVER_BYTES, validateCover } from "./cover-image.ts";

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// "RIFF", 4 bytes de tamanho, "WEBP"
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const MP3_HEADER = [0x49, 0x44, 0x33, 0x04];

/** Arquivo de `size` bytes que começa com `header`. */
function file(header: number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  return bytes;
}

describe("coverImageType", () => {
  it.each([
    ["jpeg", JPEG_HEADER],
    ["png", PNG_HEADER],
    ["webp", WEBP_HEADER],
  ] as const)("reconhece %s pelos primeiros bytes", (type, header) => {
    expect(coverImageType(file([...header]))).toBe(type);
  });

  it("recusa um MP3 e um arquivo vazio", () => {
    expect(coverImageType(file(MP3_HEADER))).toBeNull();
    expect(coverImageType(new Uint8Array(0))).toBeNull();
  });

  it("recusa um RIFF que não é WebP (como um WAV)", () => {
    expect(coverImageType(file([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("validateCover", () => {
  it.each([null, new Uint8Array(0)])("recusa %p como capa ausente", (cover) => {
    expect(() => validateCover(cover)).toThrow(new ValidationError("Album must have a cover image"));
  });

  it("aceita uma capa de exatamente 2 MB e devolve a extensão", () => {
    expect(validateCover(file(PNG_HEADER, MAX_COVER_BYTES))).toBe(".png");
  });

  it("recusa uma capa de 2 MB e 1 byte", () => {
    expect(() => validateCover(file(PNG_HEADER, MAX_COVER_BYTES + 1))).toThrow(new ValidationError("Cover image must be at most 2 MB"));
  });

  it("recusa um arquivo que não é JPEG, PNG nem WebP", () => {
    expect(() => validateCover(file(MP3_HEADER))).toThrow(new ValidationError("Cover image must be a JPEG, PNG or WebP"));
  });
});
