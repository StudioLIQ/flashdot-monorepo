"use client";

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { getTxHistory, type TxRecord } from "../lib/tx-history";

function formatRelative(seconds: number): string {
  const delta = Math.floor(Date.now() / 1000) - seconds;
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

export function RecentTransactions(): JSX.Element {
  const [records, setRecords] = useState<TxRecord[]>([]);

  useEffect(() => {
    setRecords(getTxHistory().slice(0, 5));
  }, []);

  if (!records.length) return <></>;

  return (
    <div className="border-t border-ink/10 px-4 py-3 dark:border-white/10">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink/50 dark:text-white/40">Recent</p>
      <div className="grid gap-1.5">
        {records.map((tx) => (
          <div key={tx.id} className="flex items-center gap-2 text-xs">
            {tx.status === "pending" && (
              <Loader2 size={12} className="shrink-0 animate-spin text-info" />
            )}
            {tx.status === "confirmed" && (
              <CheckCircle2 size={12} className="shrink-0 text-success" />
            )}
            {tx.status === "failed" && (
              <XCircle size={12} className="shrink-0 text-danger" />
            )}
            <span className="flex-1 truncate font-semibold">{tx.label}</span>
            <span className="text-ink/50 dark:text-white/40">{formatRelative(tx.timestamp)}</span>
            <a
              href={tx.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-info hover:text-info/80"
              aria-label="View on explorer"
            >
              <ExternalLink size={11} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
