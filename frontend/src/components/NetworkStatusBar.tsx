"use client";

import { formatUnits } from "ethers";
import { useEffect, useRef, useState } from "react";

import { HUB_RPC_URL } from "../lib/contracts";

type NetworkHealth = "connected" | "degraded" | "disconnected";

interface NetworkStatus {
  blockNumber: number | null;
  gasGwei: string | null;
  health: NetworkHealth;
}

function useNetworkStatus(): NetworkStatus {
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [gasGwei, setGasGwei] = useState<string | null>(null);
  const [health, setHealth] = useState<NetworkHealth>("disconnected");
  const failCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const [blockRes, gasPriceRes] = await Promise.all([
          fetch(HUB_RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
            signal: AbortSignal.timeout(5000),
          }),
          fetch(HUB_RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 2 }),
            signal: AbortSignal.timeout(5000),
          }),
        ]);

        const [blockData, gasPriceData] = await Promise.all([
          blockRes.json() as Promise<{ result?: string }>,
          gasPriceRes.json() as Promise<{ result?: string }>,
        ]);

        if (cancelled) return;

        const block = blockData.result ? parseInt(blockData.result, 16) : null;
        const gasWei = gasPriceData.result ? BigInt(gasPriceData.result) : null;
        const gwei = gasWei !== null
          ? `${Number(formatUnits(gasWei, "gwei")).toFixed(2)} Gwei`
          : null;

        setBlockNumber(block);
        setGasGwei(gwei);
        failCountRef.current = 0;
        setHealth("connected");
      } catch {
        if (cancelled) return;
        failCountRef.current += 1;
        setHealth(failCountRef.current >= 2 ? "disconnected" : "degraded");
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 12_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { blockNumber, gasGwei, health };
}

function healthColor(h: NetworkHealth): string {
  if (h === "connected") return "bg-success";
  if (h === "degraded") return "bg-warning animate-pulse";
  return "bg-danger animate-pulse";
}

function healthLabel(h: NetworkHealth): string {
  if (h === "connected") return "Polkadot Hub Testnet";
  if (h === "degraded") return "Degraded";
  return "Disconnected";
}

export function NetworkStatusBar(): JSX.Element {
  const { blockNumber, gasGwei, health } = useNetworkStatus();

  return (
    <>
      {/* Warning banner for non-connected state */}
      {health !== "connected" ? (
        <div
          role="alert"
          className={`w-full px-4 py-2 text-center text-xs font-semibold ${
            health === "degraded"
              ? "bg-warning/15 text-warning"
              : "bg-danger/15 text-danger"
          }`}
        >
          {health === "degraded"
            ? "⚠ Network performance degraded — RPC may be slow"
            : "✕ RPC connection lost — retrying…"}
        </div>
      ) : null}

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink/50 dark:text-white/40">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${healthColor(health)}`} />
          {healthLabel(health)}
        </span>
        {blockNumber !== null ? (
          <span>Block #{blockNumber.toLocaleString()}</span>
        ) : null}
        {gasGwei !== null ? (
          <span>Gas {gasGwei}</span>
        ) : null}
      </div>
    </>
  );
}
