import { describe, expect, it } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { Music } from "../../domain/entities/music.ts";
import type { CatalogQueries, PlayLog } from "../../domain/ports/admin-queries.ts";
import type { MusicRepository } from "../../domain/ports/music-repository.ts";
import { GetMusicAudio } from "../../domain/use-cases/get-music-audio.ts";
import { LocalFileStorage } from "../storage/local-file-storage.ts";
import { makeCatalogController } from "./admin-controller.ts";

// Entrega de arquivos (áudio e capa) sem servidor: o que acontece quando o envio do arquivo falha.

const MUSIC_ID = 1;
const ALBUM_ID = 2;
const storage = new LocalFileStorage("/nao-usado");

const musics: MusicRepository = {
  nextId: async () => MUSIC_ID,
  save: async () => {},
  findById: async () =>
    Music.create({ id: MUSIC_ID, name: "Faixa", duration: 180, artistIds: [1], audioFile: "faixa.mp3" }),
  findByIds: async () => [],
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const queries = { findAlbumCoverFile: async () => "capa.png" } as unknown as CatalogQueries;
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const plays = {} as unknown as PlayLog;

const controller = makeCatalogController(queries, plays, storage, storage, new GetMusicAudio(musics));

/** Resposta cujo envio de arquivo falha com `failure`, com ou sem os cabeçalhos já enviados. */
function failingResponse(failure: Error, headersSent: boolean): Response {
  const response = {
    locals: { birthdate: "1995-03-12" },
    headersSent,
    set: () => response,
    sendFile: (_path: string, done: (error?: Error) => void) => done(failure),
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return response as unknown as Response;
}

function request(id: number): Request {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { params: { id: String(id) } } as unknown as Request;
}

/** Os erros que o controller passou adiante para o errorHandler. */
async function forwardedErrors(handlerName: "musicAudio" | "albumCover", id: number, response: Response) {
  const errors: unknown[] = [];
  const next: NextFunction = (error?: unknown) => {
    errors.push(error);
  };
  await controller[handlerName](request(id), response, next);
  return errors;
}

const aborted = Object.assign(new Error("Request aborted"), { code: "ECONNABORTED" });
const missing = Object.assign(new Error("ENOENT"), { code: "ENOENT" });

describe("entrega de arquivos do catálogo", () => {
  it("não responde de novo quando o navegador cancela o áudio no meio do envio", async () => {
    expect(await forwardedErrors("musicAudio", MUSIC_ID, failingResponse(aborted, true))).toEqual([]);
  });

  it("responde 404 quando o arquivo de áudio não existe no disco", async () => {
    const errors = await forwardedErrors("musicAudio", MUSIC_ID, failingResponse(missing, false));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty("code", "NOT_FOUND");
  });

  it("não responde de novo quando o navegador cancela a capa no meio do envio", async () => {
    expect(await forwardedErrors("albumCover", ALBUM_ID, failingResponse(aborted, true))).toEqual([]);
  });
});
