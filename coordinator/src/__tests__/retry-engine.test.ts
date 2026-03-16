import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}));

const schemaMock = vi.hoisted(() => ({
  legs: {
    loanId: Symbol("loanId"),
    legId: Symbol("legId"),
  },
  loans: {
    loanId: Symbol("loanId"),
  },
  retryQueue: {
    id: Symbol("id"),
    nextRetryAt: Symbol("nextRetryAt"),
  },
}));

vi.mock("../db/index.js", () => ({
  db: dbMock,
}));

vi.mock("../db/schema.js", () => schemaMock);

vi.mock("../config.js", () => ({
  config: {
    retry: {
      maxRetries: 3,
      backoffMs: [100, 500, 1_000],
    },
  },
}));

function mockSelectRows(rows: Array<Record<string, unknown>>): void {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function mockDeleteChain(): void {
  dbMock.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

function mockUpdateChain(): { set: ReturnType<typeof vi.fn> } {
  const set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  dbMock.update.mockReturnValue({
    set,
  });
  return { set };
}

describe("processRetryQueue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDeleteChain();
  });

  it("executes a valid retry action and removes it from the queue", async () => {
    mockSelectRows([
      {
        id: 1,
        action: "startPrepare",
        attempts: 0,
        payload: JSON.stringify({ loanId: "12" }),
        nextRetryAt: Date.now() - 10,
      },
    ]);

    const hub = {
      getLoan: vi.fn(),
      getLeg: vi.fn(),
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      startPrepare: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue(undefined) }),
      startCommit: vi.fn(),
      finalizeSettle: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { processRetryQueue } = await import("../retry-engine.js");
    await processRetryQueue(hub);

    expect(hub.startPrepare).toHaveBeenCalledWith(12n);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("reschedules a failed retry with exponential backoff", async () => {
    mockSelectRows([
      {
        id: 2,
        action: "startCommit",
        attempts: 0,
        payload: JSON.stringify({ loanId: "7" }),
        nextRetryAt: Date.now() - 10,
      },
    ]);
    const updateChain = mockUpdateChain();

    const hub = {
      getLoan: vi.fn(),
      getLeg: vi.fn(),
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      startPrepare: vi.fn(),
      startCommit: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
      finalizeSettle: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { processRetryQueue } = await import("../retry-engine.js");
    await processRetryQueue(hub);

    expect(updateChain.set).toHaveBeenCalledTimes(1);
    expect(updateChain.set.mock.calls[0]?.[0]).toMatchObject({
      attempts: 1,
      lastError: "rpc unavailable",
    });
  });

  it("drops queue items with unsupported actions", async () => {
    mockSelectRows([
      {
        id: 3,
        action: "unsupportedAction",
        attempts: 0,
        payload: JSON.stringify({ loanId: "9" }),
        nextRetryAt: Date.now() - 10,
      },
    ]);

    const hub = {
      getLoan: vi.fn(),
      getLeg: vi.fn(),
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      startPrepare: vi.fn(),
      startCommit: vi.fn(),
      finalizeSettle: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { processRetryQueue } = await import("../retry-engine.js");
    await processRetryQueue(hub);

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(hub.startPrepare).not.toHaveBeenCalled();
  });

  it("syncs committed ack state back into the local database", async () => {
    mockSelectRows([
      {
        id: 5,
        action: "updateCommittedAck",
        attempts: 0,
        payload: JSON.stringify({ loanId: "19", legId: 2 }),
        nextRetryAt: Date.now() - 10,
      },
    ]);
    const updateChain = mockUpdateChain();

    const hub = {
      getLoan: vi.fn().mockResolvedValue({ state: 4 }),
      getLeg: vi.fn().mockResolvedValue({ state: 4 }),
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      startPrepare: vi.fn(),
      startCommit: vi.fn(),
      finalizeSettle: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { processRetryQueue } = await import("../retry-engine.js");
    await processRetryQueue(hub);

    expect(hub.getLoan).toHaveBeenCalledWith(19n);
    expect(hub.getLeg).toHaveBeenCalledWith(19n, 2);
    expect(updateChain.set).toHaveBeenNthCalledWith(1, expect.objectContaining({ state: 4 }));
    expect(updateChain.set).toHaveBeenNthCalledWith(2, expect.objectContaining({ state: 4 }));
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });

  it("drops queue items once max retries is exceeded", async () => {
    mockSelectRows([
      {
        id: 4,
        action: "triggerDefault",
        attempts: 3,
        payload: JSON.stringify({ loanId: "11" }),
        nextRetryAt: Date.now() - 10,
      },
    ]);

    const hub = {
      getLoan: vi.fn(),
      getLeg: vi.fn(),
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      startPrepare: vi.fn(),
      startCommit: vi.fn(),
      finalizeSettle: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { processRetryQueue } = await import("../retry-engine.js");
    await processRetryQueue(hub);

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(hub.triggerDefault).not.toHaveBeenCalled();
  });
});
