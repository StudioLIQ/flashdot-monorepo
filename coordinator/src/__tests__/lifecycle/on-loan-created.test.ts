import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

const schemaMock = vi.hoisted(() => ({
  loans: { loanId: Symbol("loanId"), legId: Symbol("loanLegId") },
  legs: { loanId: Symbol("legLoanId"), legId: Symbol("legId") },
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

function mockInsertChain(): Array<{ values: ReturnType<typeof vi.fn>; onConflictDoUpdate: ReturnType<typeof vi.fn> }> {
  const chains: Array<{ values: ReturnType<typeof vi.fn>; onConflictDoUpdate: ReturnType<typeof vi.fn> }> = [];
  dbMock.insert.mockImplementation(() => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    chains.push({ values, onConflictDoUpdate });
    return { values };
  });
  return chains;
}

function mockUpdateChain(): { set: ReturnType<typeof vi.fn> } {
  const set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  dbMock.update.mockReturnValue({ set });
  return { set };
}

function mockTransaction(): void {
  dbMock.transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
    callback(dbMock)
  );
}

describe("onLoanCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction();
  });

  it("stores the loan and legs, then starts prepare", async () => {
    const insertChains = mockInsertChain();
    const updateChain = mockUpdateChain();
    const startPrepareWait = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      hubContract: {
        getLoan: vi.fn().mockResolvedValue({
          borrower: "0xBorrower",
          state: 0,
          expiryAt: 1_700_000_100,
          repayOnlyMode: false,
        }),
        getBondInfo: vi.fn().mockResolvedValue({
          bondAmount: 123n,
        }),
        getLegCount: vi.fn().mockResolvedValue(2n),
        getLeg: vi
          .fn()
          .mockResolvedValueOnce({
            chain: "chain-a",
            vault: "0xVaultA",
            amount: 50n,
            state: 0,
          })
          .mockResolvedValueOnce({
            chain: "chain-b",
            vault: "0xVaultB",
            amount: 75n,
            state: 0,
          }),
        startPrepare: vi.fn().mockResolvedValue({ wait: startPrepareWait }),
        startCommit: vi.fn(),
        finalizeSettle: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    const { onLoanCreated } = await import("../../lifecycle/on-loan-created.js");
    await onLoanCreated(ctx, 42n);

    expect(insertChains).toHaveLength(3);
    expect(insertChains[0]?.values.mock.calls[0]?.[0]).toMatchObject({
      loanId: "42",
      borrower: "0xBorrower",
      bondAmount: "123",
    });
    expect(insertChains[1]?.values.mock.calls[0]?.[0]).toMatchObject({
      loanId: "42",
      legId: 0,
      vault: "0xVaultA",
    });
    expect(insertChains[2]?.values.mock.calls[0]?.[0]).toMatchObject({
      loanId: "42",
      legId: 1,
      vault: "0xVaultB",
    });
    expect(ctx.hubContract.startPrepare).toHaveBeenCalledWith(42n);
    expect(startPrepareWait).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalledWith({ state: 1, updatedAt: 1_700_000_000_000 });
  });

  it("enqueues a retry when startPrepare fails", async () => {
    mockInsertChain();
    mockUpdateChain();
    const ctx = {
      hubContract: {
        getLoan: vi.fn().mockResolvedValue({
          borrower: "0xBorrower",
          state: 0,
          expiryAt: 1_700_000_100,
          repayOnlyMode: false,
        }),
        getBondInfo: vi.fn().mockResolvedValue({
          bondAmount: 123n,
        }),
        getLegCount: vi.fn().mockResolvedValue(0n),
        getLeg: vi.fn(),
        startPrepare: vi.fn().mockRejectedValue(new Error("call reverted")),
        startCommit: vi.fn(),
        finalizeSettle: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    const { onLoanCreated } = await import("../../lifecycle/on-loan-created.js");

    await expect(onLoanCreated(ctx, 77n)).rejects.toThrow("call reverted");
    expect(enqueueRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "startPrepare",
        loanId: "77",
      })
    );
  });
});
