import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

// Drizzle Kit does not load Next.js .env.local by itself.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder" },
});
