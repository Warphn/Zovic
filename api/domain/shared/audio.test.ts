import { describe, expect, it } from "bun:test";
import { ValidationError } from "../errors/domain-error.ts";
import { isMp3, MAX_AUDIO_BYTES, validateAudio } from "./audio.ts";

const ID3_HEADER = [0x49, 0x44, 0x33, 0x04, 0x00];
const FRAME_SYNC_HEADER = [0xff, 0xfb, 0x90, 0x64];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47];

/** Arquivo de `size` bytes que começa com `header`. */
function file(header: number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  return bytes;
}

describe("isMp3", () => {
  it("aceita um arquivo com a tag ID3", () => {
    expect(isMp3(file(ID3_HEADER))).toBe(true);
  });

  it("aceita um arquivo que começa com o sincronismo de quadro MPEG", () => {
    expect(isMp3(file(FRAME_SYNC_HEADER))).toBe(true);
  });

  it("recusa um PNG", () => {
    expect(isMp3(file(PNG_HEADER))).toBe(false);
  });

  it("recusa um arquivo vazio", () => {
    expect(isMp3(new Uint8Array(0))).toBe(false);
  });

  it("recusa um 0xFF seguido de um byte sem os 3 bits altos ligados", () => {
    expect(isMp3(file([0xff, 0x1f]))).toBe(false);
  });
});

describe("validateAudio", () => {
  it.each([null, new Uint8Array(0)])("recusa %p como áudio ausente", (audio) => {
    expect(() => validateAudio(audio)).toThrow(new ValidationError("Music must have an audio file"));
  });

  it("aceita um MP3 de exatamente 20 MB", () => {
    expect(() => validateAudio(file(ID3_HEADER, MAX_AUDIO_BYTES))).not.toThrow();
  });

  it("recusa um MP3 de 20 MB e 1 byte", () => {
    expect(() => validateAudio(file(ID3_HEADER, MAX_AUDIO_BYTES + 1))).toThrow(
      new ValidationError("Audio file must be at most 20 MB"),
    );
  });

  it("recusa um arquivo que não é MP3", () => {
    expect(() => validateAudio(file(PNG_HEADER))).toThrow(new ValidationError("Audio file must be an MP3"));
  });
});
