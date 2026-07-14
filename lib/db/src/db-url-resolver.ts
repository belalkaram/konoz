import path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

try {
  let dirname = "";
  if (typeof __dirname !== "undefined") {
    dirname = __dirname;
  } else {
    const filename = fileURLToPath(import.meta.url);
    dirname = path.dirname(filename);
  }
  
  // Load the root .env file
  dotenv.config({ path: path.resolve(dirname, "../../../.env") });
} catch (e) {
  // Ignore errors in environments where env variables are already loaded
}

/**
 * Resolves the database connection string based on DB_TARGET environment variable.
 * Fallbacks to DATABASE_URL if target-specific URL is not provided.
 */
export function getDatabaseUrl(): string {
  const dbTarget = process.env.DB_TARGET || "supabase";
  
  if (dbTarget === "vps") {
    const url = process.env.DATABASE_URL_VPS || process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL_VPS is not defined in environment variables.");
    }
    return url;
  }
  
  const url = process.env.DATABASE_URL_SUPABASE || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_SUPABASE (or DATABASE_URL) is not defined in environment variables.");
  }
  return url;
}
