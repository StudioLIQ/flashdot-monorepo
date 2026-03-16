import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

const schemaMock = vi.hoisted(() => ({
  loans: {
    loanId: Symbol("loanId"),
    state: Symbol("loanState"),
    expiryAt: Symbol("expiryAt"),
    updatedAt: Symbol("loanUpdatedAt"),
    repayOnlyMode: Symbol("repayOnlyMode"),
  },
  legs: {
    loanId: Symbol("legLoanId"),
    state: Symbol("legState"),
  },
  retryQueue: {
    id: Symbol("id"),
  },
}));

vi.mock("../db/index.js", () => ({
  db: dbMock,
}));

vi.mock("../db/schema.js", () => schemaMock);

vi.mock("../config.js", () => ({
  config: {
    timeouts: {
      prepareMs: 10_000,
      commitMs: 20_000,
      defaultCheckMs: 5_000,
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

function mockUpdateChain(): { set: ReturnType<typeof vi.fn> } {
  const set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  dbMock.update.mockReturnValue({ set });
  return { set };
}

function mockInsertChain(): { values: ReturnType<typeof vi.fn> } {
  const values = vi.fn().mockResolvedValue(undefined);
  dbMock.insert.mockReturnValue({ values });
  return { values };
}

function mockTransaction(): void {
  dbMock.transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
    callback(dbMock)
  );
}

describe("timeout-enforcer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction();
  });

  it("triggers default for expired committed loans", async () => {
    mockSelectRows([{ loanId: "11", expiryAt: 1, state: 4, repayOnlyMode: false }]);
    const updateChain = mockUpdateChain();
    const hub = {
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn(),
      triggerDefault: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue(undefined) }),
    };

    const { checkExpiredLoans } = await import("../timeout-enforcer.js");
    await checkExpiredLoans(hub);

    expect(hub.triggerDefault).toHaveBeenCalledWith(11n);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ state: 9 }));
  });

  it("cancels stuck pre-commit loans and aborts their local state", async () => {
    mockSelectRows([{ loanId: "7", updatedAt: 1, state: 1, repayOnlyMode: false }]);
    const updateChain = mockUpdateChain();
    const hub = {
      cancelBeforeCommit: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue(undefined) }),
      enforceCommitTimeout: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { checkPrepareTimeouts } = await import("../timeout-enforcer.js");
    await checkPrepareTimeouts(hub);

    expect(hub.cancelBeforeCommit).toHaveBeenCalledWith(7n);
    expect(updateChain.set).toHaveBeenNthCalledWith(1, expect.objectContaining({ state: 8 }));
    expect(updateChain.set).toHaveBeenNthCalledWith(2, expect.objectContaining({ state: 6 }));
  });

  it("forces repay-only mode for stuck commit flows", async () => {
    mockSelectRows([{ loanId: "13", updatedAt: 1, state: 3, repayOnlyMode: false }]);
    const updateChain = mockUpdateChain();
    const hub = {
      cancelBeforeCommit: vi.fn(),
      enforceCommitTimeout: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue(undefined) }),
      triggerDefault: vi.fn(),
    };

    const { checkCommitTimeouts } = await import("../timeout-enforcer.js");
    await checkCommitTimeouts(hub);

    expect(hub.enforceCommitTimeout).toHaveBeenCalledWith(13n);
    expect(updateChain.set).toHaveBeenNthCalledWith(1, expect.objectContaining({ repayOnlyMode: true }));
    expect(updateChain.set).toHaveBeenNthCalledWith(2, expect.objectContaining({ state: 6 }));
  });

  it("queues a retry when a timeout action fails", async () => {
    mockSelectRows([{ loanId: "17", updatedAt: 1, state: 1, repayOnlyMode: false }]);
    const insertChain = mockInsertChain();
    const hub = {
      cancelBeforeCommit: vi.fn().mockRejectedValue(new Error("timeout tx failed")),
      enforceCommitTimeout: vi.fn(),
      triggerDefault: vi.fn(),
    };

    const { checkPrepareTimeouts } = await import("../timeout-enforcer.js");
    await checkPrepareTimeouts(hub);

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: "17",
        action: "cancelBeforeCommit",
      })
    );
  });
});
