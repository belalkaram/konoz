import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db-url-resolver";

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});

