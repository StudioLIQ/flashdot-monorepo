import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  return import("../config.js");
}

function setRequiredEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): void {
  process.env["HUB_RPC_URL"] = "http://127.0.0.1:8545";
  process.env["HUB_ADDRESS"] = "0x0000000000000000000000000000000000000001";
  process.env["VAULT_A_RPC_URL"] = "http://127.0.0.1:9545";
  process.env["VAULT_A_ADDRESS"] = "0x0000000000000000000000000000000000000002";
  process.env["VAULT_B_RPC_URL"] = "http://127.0.0.1:10545";
  process.env["VAULT_B_ADDRESS"] = "0x0000000000000000000000000000000000000003";
  process.env["COORDINATOR_PRIVATE_KEY"] = `0x${"11".repeat(32)}`;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("config", () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    vi.resetModules();
    process.env = { ...BASE_ENV };
  });

  it("fails fast when HUB_RPC_URL is missing", async () => {
    delete process.env["HUB_RPC_URL"];

    await expect(loadConfig()).rejects.toThrow(/Missing coordinator \.env file/);
  });

  it("loads required values from runtime env vars", async () => {
    setRequiredEnv({ COORDINATOR_PORT: "9001" });

    const { config } = await loadConfig();

    expect(config.hub.rpcUrl).toBe("http://127.0.0.1:8545");
    expect(config.coordinator.privateKey).toBe(`0x${"11".repeat(32)}`);
    expect(config.coordinator.port).toBe(9001);
  });

  it("parses retry delays and timeout overrides", async () => {
    setRequiredEnv({
      RETRY_DELAYS_MS: "250,500,1000",
      PREPARE_TIMEOUT_MS: "1500",
      COMMIT_TIMEOUT_MS: "2000",
      DEFAULT_CHECK_INTERVAL_MS: "3333",
    });

    const { config } = await loadConfig();

    expect(config.retry.backoffMs).toEqual([250, 500, 1000]);
    expect(config.timeouts.prepareMs).toBe(1500);
    expect(config.timeouts.commitMs).toBe(2000);
    expect(config.timeouts.defaultCheckMs).toBe(3333);
  });

  it("rejects invalid numeric env vars", async () => {
    setRequiredEnv({ MAX_RETRIES: "oops" });

    await expect(loadConfig()).rejects.toThrow('Invalid numeric env var MAX_RETRIES="oops"');
  });
});
