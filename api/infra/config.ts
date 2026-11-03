export interface Config {
  port: number;
  cookieSecure: boolean;
  trustProxy: number | null;
  betterAuthSecret: string;
  betterAuthUrl: string;
  corsOrigins: string[];
}

const MIN_SECRET_LENGTH = 32;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const port = Number(env.PORT ?? 3333);

  return {
    port,
    // Ligado por padrão; só "false" desliga (desenvolvimento em http).
    cookieSecure: env.COOKIE_SECURE !== "false",
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    betterAuthSecret: parseSecret(env.BETTER_AUTH_SECRET),
    betterAuthUrl: env.BETTER_AUTH_URL || `http://localhost:${port}`,
    corsOrigins: (env.CORS_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
  };
}

function parseSecret(value: string | undefined): string {
  if (value === undefined || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must have at least ${MIN_SECRET_LENGTH} characters (generate one with: openssl rand -base64 32)`,
    );
  }
  return value;
}

function parseTrustProxy(value: string | undefined): number | null {
  if (value === undefined || value === "") {
    return null;
  }
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error(`TRUST_PROXY must be an integer >= 1, received "${value}"`);
  }
  return hops;
}

export const config = loadConfig();
