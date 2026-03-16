import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const schemaMock = vi.hoisted(() => ({
  xcmEvents: {
    queryId: Symbol("queryId"),
    txHash: Symbol("txHash"),
    logIndex: Symbol("logIndex"),
  },
}));

const onLoanCreatedMock = vi.hoisted(() => vi.fn());
const onPreparedAckMock = vi.hoisted(() => vi.fn());
const onCommittedAckMock = vi.hoisted(() => vi.fn());
const onRepayConfirmedMock = vi.hoisted(() => vi.fn());

vi.mock("../db/index.js", () => ({
  db: dbMock,
}));

vi.mock("../db/schema.js", () => schemaMock);

vi.mock("../lifecycle/on-loan-created.js", () => ({
  onLoanCreated: onLoanCreatedMock,
}));

vi.mock("../lifecycle/on-prepared-ack.js", () => ({
  onPreparedAck: onPreparedAckMock,
}));

vi.mock("../lifecycle/on-committed-ack.js", () => ({
  onCommittedAck: onCommittedAckMock,
}));

vi.mock("../lifecycle/on-repay-confirmed.js", () => ({
  onRepayConfirmed: onRepayConfirmedMock,
}));

function mockDbForUniqueEvent(existing: Array<Record<string, unknown>> = []): void {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(existing),
    }),
  });
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

describe("startLoanWatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbForUniqueEvent();
  });

  it("records a fresh log and dispatches the handler", async () => {
    const listeners = new Map<string, (...args: unknown[]) => Promise<void>>();
    const hubContract = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => Promise<void>) => {
        listeners.set(event, listener);
      }),
      off: vi.fn(),
    };

    const { startLoanWatcher } = await import("../loan-watcher.js");
    await startLoanWatcher(hubContract as never);

    await listeners.get("LoanCreated")?.(
      9n,
      "0xBorrower",
      "0xAsset",
      100n,
      101n,
      { log: { transactionHash: "0xabc", index: 7 } }
    );

    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(onLoanCreatedMock).toHaveBeenCalledWith({ hubContract }, 9n);
  });

  it("skips duplicate logs with the same tx hash and index", async () => {
    mockDbForUniqueEvent([{ queryId: "0xabc:7" }]);
    const listeners = new Map<string, (...args: unknown[]) => Promise<void>>();
    const hubContract = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => Promise<void>) => {
        listeners.set(event, listener);
      }),
      off: vi.fn(),
    };

    const { startLoanWatcher } = await import("../loan-watcher.js");
    await startLoanWatcher(hubContract as never);

    await listeners.get("PreparedAcked")?.(
      9n,
      1n,
      "0xchain",
      { log: { transactionHash: "0xabc", index: 7 } }
    );

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(onPreparedAckMock).not.toHaveBeenCalled();
  });
});
