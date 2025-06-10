import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to create a .env file or define the variable?",
  );
}

// Render-specific logic for persistent storage
const isProduction = process.env.RENDER === "true";
const dbPath = process.env.DATABASE_URL.startsWith("sqlite:")
  ? process.env.DATABASE_URL.substring(7)
  : process.env.DATABASE_URL;

let sqlitePath: string;

if (isProduction) {
  sqlitePath = path.join("/data", "local.db");
  // Ensure the directory exists
  try {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  } catch (e) {
    console.error(`Failed to create directory for SQLite database: ${e}`);
    process.exit(1);
  }
} else {
  sqlitePath = dbPath;
}

const sqlite = new Database(sqlitePath);
export const db = drizzle(sqlite, { schema });

// pool is not typically used with better-sqlite3 in the same way as with pg/neon
// If you have specific pooling needs for SQLite, it would require a different setup.
// For now, we'll remove it or comment it out if not directly replaceable.
// export const pool = ...; // This line is removed/commented
