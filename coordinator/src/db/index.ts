import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { config } from "../config.js";
import { schema } from "./schema.js";

const migrationsFolder = "src/db/migrations";

const sqlite = new Database(config.coordinator.dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  migrate(db, { migrationsFolder });
}

export function closeDb(): void {
  sqlite.close();
}
