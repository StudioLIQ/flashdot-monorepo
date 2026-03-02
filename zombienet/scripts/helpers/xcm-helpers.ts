/**
 * XCM state query helpers using polkadot-api (PAPI).
 * Used in E2E tests to verify XCM message delivery status.
 */

export interface XcmStatus {
  sent: boolean;
  delivered: boolean;
  executed: boolean;
  error?: string;
}

/**
 * Check XCM message delivery status on a parachain.
 * In production, uses polkadot-api to query the XCM delivery queue.
 *
 * @param wsUrl      WebSocket URL of the destination chain
 * @param queryId    XCM queryId (bytes32)
 * @param timeoutMs  Max wait time in milliseconds
 */
export async function getXcmStatus(
  _wsUrl: string,
  _queryId: string,
  _timeoutMs: number
): Promise<XcmStatus> {
  // TODO (M3 T-17): Implement using polkadot-api
  // const client = await createClient(wsUrl)
  // ...
  throw new Error("TODO: implement XCM status query with polkadot-api");
}

/**
 * Wait for an XCM ACK callback to be delivered to Hub.
 * Polls Hub contract's loan/leg state until the expected state is reached.
 *
 * @param hubContract  ethers.Contract instance for FlashDotHub
 * @param loanId       Loan ID to watch
 * @param legId        Leg ID to watch
 * @param targetState  Expected LegState enum value
 * @param timeoutMs    Max wait time
 */
export async function waitForLegState(
  hubContract: unknown,
  loanId: bigint,
  legId: number,
  targetState: number,
  timeoutMs: number = 120_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // @ts-ignore
      const leg = await hubContract.getLeg(loanId, legId);
      if (Number(leg.state) === targetState) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Timeout: legId=${legId} did not reach state ${targetState} in ${timeoutMs}ms`);
}
