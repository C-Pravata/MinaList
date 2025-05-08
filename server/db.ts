import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to create a .env file or define the variable?",
  );
}

// Extract the SQLite file path from the DATABASE_URL (e.g., "sqlite:./local.db")
const sqlitePath = process.env.DATABASE_URL.startsWith("sqlite:")
  ? process.env.DATABASE_URL.substring(7)
  : process.env.DATABASE_URL;

const sqlite = new Database(sqlitePath);
export const db = drizzle(sqlite, { schema });

// pool is not typically used with better-sqlite3 in the same way as with pg/neon
// If you have specific pooling needs for SQLite, it would require a different setup.
// For now, we'll remove it or comment it out if not directly replaceable.
// export const pool = ...; // This line is removed/commented
