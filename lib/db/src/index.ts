import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { getDatabaseUrl } from "./db-url-resolver";

const { Pool } = pg;

const connectionString = getDatabaseUrl();

export const pool = new Pool({ connectionString });

// Prevent unexpected database connection errors from crashing the Node process
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";

