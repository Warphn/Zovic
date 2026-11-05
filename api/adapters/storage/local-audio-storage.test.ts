import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAudioStorage } from "./local-audio-storage.ts";

const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x2a]);

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "zovic-audio-"));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("LocalAudioStorage", () => {
  it("grava o arquivo com um nome novo e os mesmos bytes", async () => {
    const storage = new LocalAudioStorage(directory);

    const fileName = await storage.save(MP3);

    expect(fileName).toMatch(/^[0-9a-f-]{36}\.mp3$/);
    expect(new Uint8Array(await readFile(join(directory, fileName)))).toEqual(MP3);
  });

  it("dá nomes diferentes a dois arquivos iguais", async () => {
    const storage = new LocalAudioStorage(directory);

    expect(await storage.save(MP3)).not.toBe(await storage.save(MP3));
  });

  it("remove o arquivo", async () => {
    const storage = new LocalAudioStorage(directory);
    const fileName = await storage.save(MP3);

    await storage.remove(fileName);

    expect(existsSync(join(directory, fileName))).toBe(false);
  });

  it("não reclama ao remover um arquivo que não existe", async () => {
    const storage = new LocalAudioStorage(directory);

    expect(storage.remove("nao-existe.mp3")).resolves.toBeUndefined();
  });

  it("cria o diretório se ele ainda não existir", async () => {
    const storage = new LocalAudioStorage(join(directory, "novo", "audio"));

    const fileName = await storage.save(MP3);

    expect(existsSync(join(directory, "novo", "audio", fileName))).toBe(true);
  });
});
