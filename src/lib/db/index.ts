import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Global singleton — survives hot-reload in development so we don't exhaust
// the connection limit by creating a new pool on every module re-evaluation.
const globalForDb = globalThis as unknown as {
  pgClient: postgres.Sql | undefined;
  db: PostgresJsDatabase<typeof schema> | undefined;
};

function getDb(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.db) return globalForDb.db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client =
    globalForDb.pgClient ??
    postgres(process.env.DATABASE_URL, {
      // Vercel serverless: each function invocation is isolated, so a pool
      // of 1 is correct — multiple connections per invocation waste Neon's
      // connection limit. In dev, use 5 to avoid contention across
      // concurrent generateMetadata + page queries during hot-reload.
      max: process.env.NODE_ENV === "production" ? 1 : 5,
      ssl: "require",
    });

  if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") globalForDb.db = instance;

  return instance;
}

// Lazy proxy — defers client creation until the first actual DB call.
// This prevents Next.js build workers from throwing when they evaluate
// route modules before DATABASE_URL is injected into the worker process.
// For use where a real (non-proxy) drizzle instance is required, e.g. DrizzleAdapter
export { getDb as getRawDb }

export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_, prop: string | symbol) {
      const instance = getDb();
      const val = Reflect.get(instance, prop);
      return typeof val === "function" ? val.bind(instance) : val;
    },
  }
);

export type Db = typeof db;
