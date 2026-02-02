import { Pool } from "pg";

const authDbUrl = process.env.AUTH_DATABASE_URL;
const appDbUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

if (!authDbUrl) {
  throw new Error("AUTH_DATABASE_URL is not set.");
}

if (!appDbUrl) {
  throw new Error("APP_DATABASE_URL is not set.");
}

export const authPool = new Pool({ connectionString: authDbUrl });
export const appPool = new Pool({ connectionString: appDbUrl });
