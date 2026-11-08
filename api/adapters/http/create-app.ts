import express from "express";
import cors from "cors";
import type { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import swaggerUi from "swagger-ui-express";
import { CLIENT_IP_HEADER } from "../auth/create-auth.ts";
import type { Auth } from "../auth/create-auth.ts";
import { hideSessionTokens } from "./hide-session-tokens.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { openApiDocument } from "./openapi.ts";

export interface AppOptions {
  auth: Auth;
  router: Router;
  /** Número de proxies confiáveis à frente da API (null: exposta direto). */
  trustProxy: number | null;
  /** Origens do frontend que podem chamar a API com o cookie (lista exata; vazia: nenhuma). */
  corsOrigins: string[];
}

export function createApp({ auth, router, trustProxy, corsOrigins }: AppOptions) {
  const app = express();

  if (trustProxy !== null) {
    app.set("trust proxy", trustProxy);
  }

  // CORS antes do Better Auth, para ele responder o preflight das rotas de auth. Só as origens
  // listadas recebem Access-Control-Allow-Origin; com credentials, nunca refletir qualquer origem.
  // A proteção contra CSRF continua sendo SameSite=Lax + a checagem de Origin do Better Auth.
  app.use(cors({ origin: corsOrigins, credentials: true }));

  // O Better Auth vai antes do express.json(): ele lê o corpo da requisição sozinho.
  // O IP que ele usa no rate limit vem do Express (req.ip, que respeita o trust proxy);
  // um cabeçalho com esse nome enviado pelo cliente é sobrescrito.
  app.all(
    "/api/auth/*splat",
    (req, _res, next) => {
      req.headers[CLIENT_IP_HEADER] = req.ip;
      next();
    },
    toNodeHandler(hideSessionTokens(auth.handler)),
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.sendStatus(200);
  });

  app.get("/docs/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use("/api", router);
  app.use(errorHandler);

  return app;
}
