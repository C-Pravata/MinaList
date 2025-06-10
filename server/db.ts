import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to create a .env file or define the variable?",
  );
}

// For Vercel, it's recommended to use the `POSTGRES_URL_NON_POOLING`
// for Drizzle/non-HTTP connections. Otherwise, use DATABASE_URL.
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

// Create a connection pool.
const pool = new Pool({
  connectionString,
  ssl: {
    // Supabase requires SSL, but does not require you to provide a CA certificate.
    // Set rejectUnauthorized to false to allow connections without a CA certificate.
    // This is generally safe for connections to known services like Supabase.
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema });
