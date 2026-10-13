import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 5_000,
  query_timeout: 10_000,
});
