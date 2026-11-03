import { Pool, types } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 5_000,
  query_timeout: 10_000,
  // Colunas `date` (ex.: user.birthdate) voltam como "AAAA-MM-DD". O parser padrão do pg
  // as converteria em Date à meia-noite do fuso do servidor, e a data poderia mudar de dia.
  types: {
    getTypeParser: (oid, format) =>
      oid === types.builtins.DATE ? (value: string) => value : types.getTypeParser(oid, format),
  },
});
