import type { PoolClient } from "pg";
import { Pool } from "pg";

const AUTH_SCHEMA = "next_auth";

/** Normalize URL for node-postgres: strip +psycopg2, fix host for local dev (postgres:5432 -> localhost:5433). */
function normalizeDbUrl(url: string): string {
  let out = url.replace(/^postgresql\+[^:]+:/, "postgresql:");
  if (process.env.NODE_ENV === "development" && /@postgres:5432\//.test(out)) {
    out = out.replace("@postgres:5432/", "@localhost:5433/");
  }
  return out;
}

const authDbUrlRaw = process.env.AUTH_DATABASE_URL;
const appDbUrlRaw =
  process.env.APP_DATABASE_URL ||
  process.env.DATABASE_URL ||
  authDbUrlRaw;

const authDbUrl = authDbUrlRaw ? normalizeDbUrl(authDbUrlRaw) : "";
const appDbUrl = appDbUrlRaw ? normalizeDbUrl(appDbUrlRaw) : "";

if (!authDbUrl) {
  throw new Error("AUTH_DATABASE_URL is not set.");
}

if (!appDbUrl) {
  throw new Error(
    "APP_DATABASE_URL or DATABASE_URL (or AUTH_DATABASE_URL) is not set."
  );
}

const rawAuthPool = new Pool({ connectionString: authDbUrl });

async function setSearchPath(client: PoolClient, schema: string): Promise<void> {
  await client.query(`SET search_path TO ${schema}`);
}

/**
 * Wraps a pg Pool so every use runs with search_path set to next_auth.
 * Required when using Supabase transaction-mode pooler (port 6543), which
 * does not reliably preserve options=-c search_path from the URL.
 */
function poolWithSearchPath(pool: Pool, schema: string): Pool {
  return {
    ...pool,
    async query(...args: Parameters<Pool["query"]>) {
      const client = await pool.connect();
      try {
        await setSearchPath(client, schema);
        return client.query(...args);
      } finally {
        client.release();
      }
    },
    async connect() {
      const client = await pool.connect();
      await setSearchPath(client, schema);
      return client;
    },
  } as Pool;
}

/** Use this for NextAuth adapter so users/accounts/sessions resolve in next_auth schema. */
export const authPool = poolWithSearchPath(rawAuthPool, AUTH_SCHEMA);

/** App tables (resume_sessions, resumes, etc.) live in public. Set search_path so unqualified names resolve. */
const rawAppPool = new Pool({ connectionString: appDbUrl });
export const appPool = poolWithSearchPath(rawAppPool, "public");
