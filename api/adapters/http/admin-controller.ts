import type { Request, RequestHandler, Response } from "express";
import type { RemoveCommentAsAdminUseCase } from "../../domain/use-cases/remove-comment-as-admin.ts";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { AdminQueries, CatalogQueries, PlayLog } from "../../domain/ports/admin-queries.ts";
import { canSeeExplicit } from "../../domain/shared/age.ts";
import type { GetMusicAudio } from "../../domain/use-cases/get-music-audio.ts";
import type { ManageCatalog } from "../../domain/use-cases/manage-catalog.ts";
import type { ManageUsers } from "../../domain/use-cases/manage-users.ts";
import type { LocalFileStorage } from "../storage/local-file-storage.ts";
import { IMAGE_CACHE_CONTROL, sendStoredFile } from "./send-stored-file.ts";

/** Quantas reproduções recentes o painel mostra por usuário. */
const RECENT_PLAYS_LIMIT = 50;

/**
 * O navegador guarda o arquivo, mas confirma com a API antes de cada uso (304 pelo ETag). Assim a
 * assinatura e a idade valem também para o que está no cache, mesmo com outra pessoa no mesmo navegador.
 */
const AUDIO_CACHE_CONTROL = "private, no-cache";

/** Id da URL; um id malformado é tratado como registro inexistente. */
function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError("Not found");
  return id;
}

function searchParam(req: Request): string | undefined {
  return typeof req.query.q === "string" ? req.query.q : undefined;
}

/** Quem fez a requisição pode ver música explícita hoje (HU-09). */
function canSeeExplicitNow(res: Response): boolean {
  return canSeeExplicit(res.locals.birthdate, new Date(), res.locals.role === "admin");
}

export interface CatalogController {
  listMusics: RequestHandler;
  listArtists: RequestHandler;
  listAlbums: RequestHandler;
  albumCover: RequestHandler;
  artistImage: RequestHandler;
  musicAudio: RequestHandler;
  listGenres: RequestHandler;
  recordPlay: RequestHandler;
}

export function makeCatalogController(
  queries: CatalogQueries,
  plays: PlayLog,
  covers: LocalFileStorage,
  audio: LocalFileStorage,
  getMusicAudio: GetMusicAudio,
): CatalogController {
  return {
    // Músicas removidas só aparecem para admins (e vêm com deletedAt preenchido).
    listMusics: async (req, res) => {
      res.json(
        await queries.listMusics({
          search: searchParam(req),
          includeDeleted: res.locals.role === "admin",
          includeExplicit: canSeeExplicitNow(res),
        }),
      );
    },
    listArtists: async (_req, res) => {
      res.json(await queries.listArtists());
    },
    listAlbums: async (_req, res) => {
      res.json(await queries.listAlbums({ includeExplicit: canSeeExplicitNow(res) }));
    },
    albumCover: async (req, res, next) => {
      const coverFile = await queries.findAlbumCoverFile(idParam(req));
      if (!coverFile) throw new NotFoundError("Cover not found");
      sendStoredFile(res, next, { path: covers.pathOf(coverFile), cacheControl: IMAGE_CACHE_CONTROL, notFoundMessage: "Cover not found" });
    },
    artistImage: async (req, res, next) => {
      const imageFile = await queries.findArtistImageFile(idParam(req));
      if (!imageFile) throw new NotFoundError("Image not found");
      sendStoredFile(res, next, { path: covers.pathOf(imageFile), cacheControl: IMAGE_CACHE_CONTROL, notFoundMessage: "Image not found" });
    },
    musicAudio: async (req, res, next) => {
      const { audioFile } = await getMusicAudio.execute({
        musicId: idParam(req),
        birthdate: res.locals.birthdate,
        now: new Date(),
        isAdmin: res.locals.role === "admin",
      });
      // O <audio> usa o Range (206) para pular trechos, e cancela downloads o tempo todo.
      sendStoredFile(res, next, { path: audio.pathOf(audioFile), cacheControl: AUDIO_CACHE_CONTROL, notFoundMessage: "Audio not found" });
    },
    listGenres: async (_req, res) => {
      res.json(await queries.listGenres());
    },
    recordPlay: async (req, res) => {
      await plays.recordPlay(res.locals.userId, idParam(req), canSeeExplicitNow(res));
      res.sendStatus(204);
    },
  };
}

export interface AdminController {
  stats: RequestHandler;
  listUsers: RequestHandler;
  createUser: RequestHandler;
  removeUser: RequestHandler;
  recentPlays: RequestHandler;
  createMusic: RequestHandler;
  updateMusic: RequestHandler;
  removeMusic: RequestHandler;
  createAlbum: RequestHandler;
  updateAlbum: RequestHandler;
  removeAlbum: RequestHandler;
  changeAlbumCover: RequestHandler;
  changeArtistImage: RequestHandler;
  removeArtistImage: RequestHandler;
  createGenre: RequestHandler;
  createArtist: RequestHandler;
  renameArtist: RequestHandler;
  removeArtist: RequestHandler;
  listCommentReports: RequestHandler;
  removeComment: RequestHandler;
}

export function makeAdminController(
  queries: AdminQueries,
  users: ManageUsers,
  catalog: ManageCatalog,
  removeComment: RemoveCommentAsAdminUseCase,
): AdminController {
  return {
    stats: async (_req, res) => {
      res.json(await queries.stats());
    },
    listUsers: async (req, res) => {
      res.json(await queries.listUsers(searchParam(req)));
    },
    createUser: async (req, res) => {
      res.status(201).json(await users.create(req.body));
    },
    removeUser: async (req, res) => {
      await users.remove(res.locals.userId, idParam(req));
      res.sendStatus(204);
    },
    recentPlays: async (req, res) => {
      const plays = await queries.recentPlays(idParam(req), RECENT_PLAYS_LIMIT);
      if (!plays) throw new NotFoundError("User not found");
      res.json(plays);
    },
    createMusic: async (req, res) => {
      // O receiveAudio deixa o arquivo da parte "audio" em req.file; sem ela, o domínio recusa.
      res.status(201).json(await catalog.createMusic(req.body, req.file?.buffer ?? null));
    },
    updateMusic: async (req, res) => {
      res.json(await catalog.updateMusic(idParam(req), req.body));
    },
    removeMusic: async (req, res) => {
      await catalog.deleteMusic(idParam(req));
      res.sendStatus(204);
    },
    createAlbum: async (req, res) => {
      // O receiveCover deixa a imagem da parte "cover" em req.file; sem ela, o domínio recusa.
      res.status(201).json(await catalog.createAlbum(req.body, req.file?.buffer ?? null));
    },
    updateAlbum: async (req, res) => {
      res.json(await catalog.updateAlbum(idParam(req), req.body));
    },
    removeAlbum: async (req, res) => {
      await catalog.deleteAlbum(idParam(req));
      res.sendStatus(204);
    },
    changeAlbumCover: async (req, res) => {
      res.json(await catalog.changeAlbumCover(idParam(req), req.file?.buffer ?? null));
    },
    changeArtistImage: async (req, res) => {
      // O receiveArtistImage deixa a imagem da parte "image" em req.file; sem ela, o domínio recusa.
      res.json(await catalog.changeArtistImage(idParam(req), req.file?.buffer ?? null));
    },
    removeArtistImage: async (req, res) => {
      res.json(await catalog.removeArtistImage(idParam(req)));
    },
    createGenre: async (req, res) => {
      res.status(201).json(await catalog.createGenre(req.body));
    },
    createArtist: async (req, res) => {
      res.status(201).json(await catalog.createArtist(req.body.name));
    },
    renameArtist: async (req, res) => {
      res.json(await catalog.renameArtist(idParam(req), req.body.name));
    },
    removeArtist: async (req, res) => {
      await catalog.deleteArtist(idParam(req));
      res.sendStatus(204);
    },
    listCommentReports: async (_req, res) => {
      res.json(await queries.listReportedComments());
    },
    removeComment: async (req, res) => {
      await removeComment.execute({ adminId: res.locals.userId, commentId: idParam(req) });
      res.sendStatus(204);
    },
  };
}
