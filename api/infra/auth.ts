import { createAuth } from "../adapters/auth/create-auth.ts";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";

export const auth = createAuth(pool, {
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,
  trustedOrigins: config.corsOrigins,
  cookieSecure: config.cookieSecure,
  rateLimit: true,
});
