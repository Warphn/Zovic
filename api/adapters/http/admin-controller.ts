import type { Request, RequestHandler } from "express";
import { NotFoundError } from "../../domain/errors/domain-error.ts";
import type { AdminQueries, CatalogQueries, PlayLog } from "../../domain/ports/admin-queries.ts";
import type { ManageCatalog } from "../../domain/use-cases/manage-catalog.ts";
import type { ManageUsers } from "../../domain/use-cases/manage-users.ts";

/** Quantas reproduções recentes o painel mostra por usuário. */
const RECENT_PLAYS_LIMIT = 50;

/** Id da URL; um id malformado é tratado como registro inexistente. */
function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError("Not found");
  return id;
}

function searchParam(req: Request): string | undefined {
  return typeof req.query.q === "string" ? req.query.q : undefined;
}

export interface CatalogController {
  listMusics: RequestHandler;
  listArtists: RequestHandler;
  listGenres: RequestHandler;
  recordPlay: RequestHandler;
}

export function makeCatalogController(queries: CatalogQueries, plays: PlayLog): CatalogController {
  return {
    // Músicas removidas só aparecem para admins (e vêm com deletedAt preenchido).
    listMusics: async (req, res) => {
      res.json(await queries.listMusics({ search: searchParam(req), includeDeleted: res.locals.role === "admin" }));
    },
    listArtists: async (_req, res) => {
      res.json(await queries.listArtists());
    },
    listGenres: async (_req, res) => {
      res.json(await queries.listGenres());
    },
    recordPlay: async (req, res) => {
      await plays.recordPlay(res.locals.userId, idParam(req));
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
  createArtist: RequestHandler;
  renameArtist: RequestHandler;
  removeArtist: RequestHandler;
}

export function makeAdminController(queries: AdminQueries, users: ManageUsers, catalog: ManageCatalog): AdminController {
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
      res.status(201).json(await catalog.createMusic(req.body));
    },
    updateMusic: async (req, res) => {
      res.json(await catalog.updateMusic(idParam(req), req.body));
    },
    removeMusic: async (req, res) => {
      await catalog.deleteMusic(idParam(req));
      res.sendStatus(204);
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
  };
}
