"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { getTxHistory, type TxRecord } from "../lib/tx-history";
import { LoanStatus } from "./LoanStatus";
import { Skeleton } from "./Skeleton";

interface LoanDetailPageProps {
  loanId: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusDot(status: TxRecord["status"]): string {
  if (status === "confirmed") return "bg-success";
  if (status === "failed") return "bg-danger";
  return "bg-warning animate-pulse";
}

interface TxLogProps {
  loanId: string;
}

function TxLog({ loanId }: TxLogProps): JSX.Element {
  const [records, setRecords] = useState<TxRecord[]>([]);

  useEffect(() => {
    const all = getTxHistory();
    // Filter transactions that mention this loan ID in the label
    const filtered = all.filter((tx) => tx.label.includes(`#${loanId}`) || tx.label.includes(`loan ${loanId}`));
    setRecords(filtered);
  }, [loanId]);

  if (records.length === 0) return <></>;

  return (
    <div className="mt-6 rounded-2xl border border-ink/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55 dark:text-white/45">
        Transaction Log
      </h3>
      <div className="mt-3 space-y-2">
        {records.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 rounded-xl border border-ink/8 bg-ink/3 px-3 py-2.5 dark:border-white/8 dark:bg-white/3"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusDot(tx.status)}`}
              aria-label={tx.status}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{tx.label}</p>
              <p className="font-mono text-xs text-ink/55 dark:text-white/45">
                {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-ink/55 dark:text-white/45">{formatTime(tx.timestamp)}</p>
              <a
                href={tx.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                aria-label={`View transaction on explorer`}
              >
                Explorer
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoanDetailPage({ loanId }: LoanDetailPageProps): JSX.Element {
  const { account, isConnected } = useWallet();
  const myLoansQuery = useMyLoans(account);
  const loanHistoryQuery = useLoanHistory(account);
  const loanQuery = useLoan(loanId);

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-semibold text-ink/70 dark:text-white/65">
            Connect wallet to view loan detail.
          </p>
        </div>
      </main>
    );
  }

  if (loanQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8 animate-content-fade">
      <div className="mb-4">
        <Link
          href="/loans"
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink dark:text-white/55 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          All Loans
        </Link>
      </div>

      <LoanStatus
        loan={loanQuery.data?.loan ?? null}
        legs={loanQuery.data?.legs ?? []}
        loading={loanQuery.isLoading}
        refreshing={loanQuery.isFetching}
        onRepaid={() => {
          void loanQuery.refetch();
          void myLoansQuery.refetch();
          void loanHistoryQuery.refetch();
        }}
      />

      <TxLog loanId={loanId} />
    </main>
  );
}
