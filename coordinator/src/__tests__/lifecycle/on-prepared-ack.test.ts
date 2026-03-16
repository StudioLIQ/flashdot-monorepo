import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  update: vi.fn(),
  select: vi.fn(),
}));

const schemaMock = vi.hoisted(() => ({
  loans: { loanId: Symbol("loanId"), state: Symbol("loanState") },
  legs: { loanId: Symbol("legLoanId"), legId: Symbol("legId"), state: Symbol("legState") },
}));

const enqueueRetryMock = vi.hoisted(() => vi.fn());

vi.mock("../../db/index.js", () => ({
  db: dbMock,
}));

vi.mock("../../db/schema.js", () => schemaMock);

vi.mock("../../lifecycle/shared.js", () => ({
  nowMs: () => 1_700_000_000_000,
  enqueueRetry: enqueueRetryMock,
}));

function mockUpdateChain(): Array<{ set: ReturnType<typeof vi.fn> }> {
  const chains: Array<{ set: ReturnType<typeof vi.fn> }> = [];
  dbMock.update.mockImplementation(() => {
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    chains.push({ set });
    return { set };
  });
  return chains;
}

function mockSelectRows(rows: Array<Array<{ state: number }>>): void {
  const queue = [...rows];
  dbMock.select.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(async () => queue.shift() ?? []),
    }),
  }));
}

describe("onPreparedAck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts commit once every leg is prepared", async () => {
    const updateChains = mockUpdateChain();
    mockSelectRows([[{ state: 2 }, { state: 2 }]]);
    const wait = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      hubContract: {
        startCommit: vi.fn().mockResolvedValue({ wait }),
      },
    };

    const { onPreparedAck } = await import("../../lifecycle/on-prepared-ack.js");
    await onPreparedAck(ctx as never, 5n, 1n);

    expect(ctx.hubContract.startCommit).toHaveBeenCalledWith(5n);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(updateChains[2]?.set).toHaveBeenCalledWith({ state: 3, updatedAt: 1_700_000_000_000 });
  });

  it("keeps the loan in preparing while legs are still pending", async () => {
    const updateChains = mockUpdateChain();
    mockSelectRows([[{ state: 2 }, { state: 1 }]]);
    const ctx = {
      hubContract: {
        startCommit: vi.fn(),
      },
    };

    const { onPreparedAck } = await import("../../lifecycle/on-prepared-ack.js");
    await onPreparedAck(ctx as never, 5n, 0n);

    expect(ctx.hubContract.startCommit).not.toHaveBeenCalled();
    expect(updateChains).toHaveLength(2);
    expect(updateChains[1]?.set).toHaveBeenCalledWith({ state: 1, updatedAt: 1_700_000_000_000 });
  });
});
