/**
 * Coordinator configuration loader.
 * Fails fast when .env is missing, then validates required values.
 */

import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const ENV_PATH = path.resolve(process.cwd(), ".env");

if (!fs.existsSync(ENV_PATH)) {
  throw new Error(
    `Missing coordinator .env file at "${ENV_PATH}". Copy ".env.example" to ".env" and fill values.`
  );
}

loadDotenv({ path: ENV_PATH });

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function parseNumber(key: string, fallback: string): number {
  const raw = optional(key, fallback);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env var ${key}="${raw}"`);
  }
  return parsed;
}

function parseDelays(key: string, fallback: string): number[] {
  const raw = optional(key, fallback);
  const values = raw.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`Invalid delay list env var ${key}="${raw}"`);
  }
  return values;
}

export const config = {
  hub: {
    rpcUrl: required("HUB_RPC_URL"),
    wsUrl: optional("HUB_WS_URL", "ws://127.0.0.1:9946"),
    address: required("HUB_ADDRESS"),
  },
  vaultA: {
    rpcUrl: required("VAULT_A_RPC_URL"),
    address: required("VAULT_A_ADDRESS"),
  },
  vaultB: {
    rpcUrl: required("VAULT_B_RPC_URL"),
    address: required("VAULT_B_ADDRESS"),
  },
  coordinator: {
    privateKey: required("COORDINATOR_PRIVATE_KEY"),
    dbPath: optional("DB_PATH", "./coordinator.db"),
    port: parseNumber("COORDINATOR_PORT", "8787"),
  },
  retry: {
    maxRetries: parseNumber("MAX_RETRIES", "5"),
    backoffMs: parseDelays("RETRY_DELAYS_MS", "1000,2000,5000,15000,60000"),
  },
  timeouts: {
    prepareMs: parseNumber("PREPARE_TIMEOUT_MS", "120000"),
    commitMs: parseNumber("COMMIT_TIMEOUT_MS", "120000"),
    defaultCheckMs: parseNumber("DEFAULT_CHECK_INTERVAL_MS", "10000"),
  },
} as const;
