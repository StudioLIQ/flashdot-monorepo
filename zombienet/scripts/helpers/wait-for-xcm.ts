/**
 * Utility for waiting on XCM ACK delivery to Hub.
 * Polls Hub contract state at intervals until expected state reached or timeout.
 */

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes (XCM latency budget)

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Wait for Hub's loan to reach a target LoanState.
 */
export async function waitForLoanState(
  hubContract: unknown,
  loanId: bigint,
  targetState: number,
  opts: WaitOptions = {}
): Promise<void> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    // @ts-ignore
    const loan = await hubContract.getLoan(loanId);
    if (Number(loan.state) === targetState) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `Timeout (${timeout}ms): loanId=${loanId} did not reach LoanState=${targetState}`
  );
}

/**
 * Wait for a specific leg to reach a target LegState.
 */
export async function waitForLegState(
  hubContract: unknown,
  loanId: bigint,
  legId: number,
  targetState: number,
  opts: WaitOptions = {}
): Promise<void> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    // @ts-ignore
    const leg = await hubContract.getLeg(loanId, legId);
    if (Number(leg.state) === targetState) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `Timeout (${timeout}ms): loanId=${loanId} legId=${legId} did not reach LegState=${targetState}`
  );
}
