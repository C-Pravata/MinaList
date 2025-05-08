import { defineConfig } from "drizzle-kit";

// It's assumed that process.env.DATABASE_URL is populated by the script
// that invokes drizzle-kit, e.g., using `node -r dotenv/config`.

if (!process.env.DATABASE_URL) {
  console.error(
    "drizzle.config.ts: DATABASE_URL is not found in process.env.",
    "Ensure your .env file is correct and that your npm script (e.g., db:push)",
    "is preloading dotenv (e.g., using `node -r dotenv/config ... drizzle-kit ...`)."
  );
  console.error(`Value of DATABASE_URL in drizzle.config.ts: ${process.env.DATABASE_URL}`);
  throw new Error("DATABASE_URL not set for Drizzle Kit.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
