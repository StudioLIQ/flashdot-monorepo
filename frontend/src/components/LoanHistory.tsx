"use client";

import { formatEther } from "ethers";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useLoan } from "../hooks/useLoan";
import { EXPLORER_TX_URL } from "../lib/contracts";
import { LEG_STEP_META, LegState, LOAN_STATE_META, LoanState, type LegView, type LoanView } from "../lib/loan-types";
import { Skeleton } from "./Skeleton";

const PAGE_SIZE = 10;

type SortKey = "loanId" | "bondAmount" | "state" | "expiryAt";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "settled" | "defaulted" | "aborted";

interface LoanHistoryProps {
  loans: LoanView[];
  loading?: boolean;
}

function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} DOT`;
}

function statusTone(state: number): string {
  if (state === LoanState.Settled) return "bg-success/20 text-ink dark:text-white";
  if (state === LoanState.Defaulted) return "bg-danger/20 text-danger";
  return "bg-ink/10 text-ink/70 dark:bg-white/10 dark:text-white/60";
}

function formatRelative(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = seconds - now;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(delta) < 60) return rtf.format(Math.round(delta), "second");
  if (Math.abs(delta) < 3_600) return rtf.format(Math.round(delta / 60), "minute");
  if (Math.abs(delta) < 86_400) return rtf.format(Math.round(delta / 3_600), "hour");
  return rtf.format(Math.round(delta / 86_400), "day");
}

function bondOutcome(loan: LoanView): string {
  if (loan.state === LoanState.Settled) return `Returned ${formatDot(loan.bondAmount)}`;
  if (loan.state === LoanState.Defaulted) return "Slashed by protocol";
  if (loan.state === LoanState.Aborted) return "Returned minus fees";
  return "—";
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }): JSX.Element {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="opacity-40" />;
  return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

function legStateLabel(state: number): string {
  if (state === LegState.Init) return "Init";
  if (state === LegState.PrepareSent) return "Requesting Lock";
  if (state === LegState.PreparedAcked) return "Lock Confirmed";
  if (state === LegState.CommitSent) return "Disbursing";
  if (state === LegState.CommittedAcked) return "Funds Sent";
  if (state === LegState.RepaidConfirmed) return "Repaid";
  if (state === LegState.Aborted) return "Aborted";
  if (state === LegState.DefaultPaid) return "Default Paid";
  return `State ${state}`;
}

function legStateTone(state: number): string {
  if (state === LegState.RepaidConfirmed) return "text-success";
  if (state === LegState.Aborted || state === LegState.DefaultPaid) return "text-danger";
  return "text-ink/65 dark:text-white/60";
}

interface LegMiniTimelineProps {
  leg: LegView;
}

function LegMiniTimeline({ leg }: LegMiniTimelineProps): JSX.Element {
  // Steps in order; show as a linear timeline
  const steps = LEG_STEP_META;
  const currentStateIdx = steps.findIndex((s) => s.state === leg.state);
  const isTerminal = leg.state === LegState.RepaidConfirmed || leg.state === LegState.Aborted || leg.state === LegState.DefaultPaid;

  return (
    <div className="mt-2 flex items-center gap-0">
      {steps.map((step, i) => {
        const done = isTerminal
          ? leg.state === LegState.RepaidConfirmed
          : i <= currentStateIdx;
        const active = i === currentStateIdx && !isTerminal;
        return (
          <div key={step.state} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 ${done ? "bg-success" : "bg-ink/15 dark:bg-white/15"}`}
                />
              )}
              <div
                className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-white"
                      : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/40"
                }`}
              >
                {done ? "✓" : i + 1}
                {active && (
                  <span className="absolute inset-0 animate-step-ring rounded-full bg-primary opacity-50" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${done ? "bg-success" : "bg-ink/15 dark:bg-white/15"}`}
                />
              )}
            </div>
            <p className={`mt-1 text-center text-[9px] font-medium leading-tight ${
              done ? "text-success" : active ? "text-primary" : "text-ink/40 dark:text-white/35"
            }`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface LegMiniCardProps {
  leg: LegView;
}

function LegMiniCard({ leg }: LegMiniCardProps): JSX.Element {
  const explorerUrl = EXPLORER_TX_URL("");
  const baseExplorer = explorerUrl.replace(/\/tx\/$/, "");
  const vaultExplorerUrl = `${baseExplorer}/address/${leg.vault}`;

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/50 dark:text-white/40">
            Leg #{leg.legId}
          </p>
          <a
            href={vaultExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-ink/65 transition hover:text-primary dark:text-white/55"
            title={leg.vault}
          >
            {leg.vault.slice(0, 8)}…{leg.vault.slice(-6)}
          </a>
        </div>
        <span className={`text-xs font-semibold ${legStateTone(leg.state)}`}>
          {legStateLabel(leg.state)}
        </span>
      </div>

      <div className="mt-2 flex gap-4 text-xs">
        <div>
          <p className="text-[10px] text-ink/50 dark:text-white/40">Borrowed</p>
          <p className="font-mono font-semibold">{formatDot(leg.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-ink/50 dark:text-white/40">To Repay</p>
          <p className="font-mono font-semibold text-warning">{formatDot(leg.repayAmount)}</p>
        </div>
      </div>

      {/* Mini step timeline */}
      <LegMiniTimeline leg={leg} />
    </div>
  );
}

interface HistoryRowProps {
  loan: LoanView;
  expanded: boolean;
  onToggle: () => void;
}

function HistoryRow({ loan, expanded, onToggle }: HistoryRowProps): JSX.Element {
  const loanQuery = useLoan(expanded ? loan.loanId : null);
  const legs = loanQuery.data?.legs ?? [];

  return (
    <div className="elevation-0 overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full rounded-xl px-4 py-3 text-left transition hover:bg-ink/3 dark:hover:bg-white/3"
      >
        {/* Mobile */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <div>
            <p className="font-mono text-sm font-semibold">Loan #{loan.loanId}</p>
            <p className="mt-0.5 font-mono text-xs text-ink/70 dark:text-white/65">{formatDot(loan.bondAmount)}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(loan.state)}`}>
              {LOAN_STATE_META[loan.state]?.label ?? "Unknown"}
            </span>
            <p className="mt-0.5 text-xs text-ink/60 dark:text-white/55">{formatRelative(loan.expiryAt)}</p>
          </div>
        </div>
        {/* Desktop */}
        <div className="hidden grid-cols-[80px_1fr_150px_1fr_110px] gap-3 sm:grid">
          <p className="font-mono text-sm font-semibold">#{loan.loanId}</p>
          <p className="font-mono text-sm text-ink/80 dark:text-white/80">{formatDot(loan.bondAmount)}</p>
          <p>
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(loan.state)}`}>
              {LOAN_STATE_META[loan.state]?.label ?? "Unknown"}
            </span>
          </p>
          <p className="text-sm text-ink/80 dark:text-white/80">{bondOutcome(loan)}</p>
          <p className="text-sm text-ink/70 dark:text-white/70">{formatRelative(loan.expiryAt)}</p>
        </div>
      </button>

      {/* Expandable details — CSS max-height transition for smooth animation */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? "600px" : "0px",
          overflow: "hidden",
        }}
        aria-hidden={!expanded}
      >
        <div className="border-t border-ink/10 px-4 pb-4 pt-3 dark:border-white/10">
          {loanQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton height={80} />
              <Skeleton height={80} />
            </div>
          ) : legs.length === 0 ? (
            <p className="text-xs text-ink/55 dark:text-white/45">No leg data available.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {legs.map((leg) => (
                <LegMiniCard key={`${leg.loanId}-${leg.legId}`} leg={leg} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoanHistory({ loans, loading }: LoanHistoryProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchId, setSearchId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("loanId");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = [...loans];

    if (searchId.trim()) {
      result = result.filter((l) => l.loanId.includes(searchId.trim()));
    }

    if (statusFilter !== "all") {
      const stateMap: Record<StatusFilter, number | null> = {
        all: null,
        settled: LoanState.Settled,
        defaulted: LoanState.Defaulted,
        aborted: LoanState.Aborted,
      };
      const target = stateMap[statusFilter];
      if (target !== null) result = result.filter((l) => l.state === target);
    }

    result.sort((a, b) => {
      let delta = 0;
      if (sortKey === "loanId") delta = Number(BigInt(a.loanId) - BigInt(b.loanId));
      else if (sortKey === "bondAmount") delta = Number(a.bondAmount - b.bondAmount);
      else if (sortKey === "state") delta = a.state - b.state;
      else if (sortKey === "expiryAt") delta = a.expiryAt - b.expiryAt;
      return sortDir === "asc" ? delta : -delta;
    });

    return result;
  }, [loans, statusFilter, searchId, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={48} />)}
      </div>
    );
  }

  return (
    <section aria-labelledby="history-title">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search by ID */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/45 dark:text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search ID…"
            value={searchId}
            onChange={(e) => { setSearchId(e.target.value); setPage(1); }}
            className="h-8 rounded-lg border border-ink/20 bg-white pl-7 pr-3 text-xs font-mono dark:border-white/20 dark:bg-slate-900 w-28"
            aria-label="Search by loan ID"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {([
            { val: "all", label: "All" },
            { val: "settled", label: "Settled" },
            { val: "defaulted", label: "Defaulted" },
            { val: "aborted", label: "Aborted" },
          ] as Array<{ val: StatusFilter; label: string }>).map(({ val, label }) => (
            <button
              key={val}
              type="button"
              onClick={() => { setStatusFilter(val); setPage(1); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                statusFilter === val
                  ? "border-primary/50 bg-primary/15 text-ink dark:text-white"
                  : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/8"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-ink/55 dark:text-white/45">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table header (desktop) */}
      <div className="mb-1 hidden grid-cols-[80px_1fr_150px_1fr_110px] gap-3 px-4 sm:grid">
        {([
          { key: "loanId" as SortKey, label: "ID" },
          { key: "bondAmount" as SortKey, label: "Bond" },
          { key: "state" as SortKey, label: "Status" },
          { key: null, label: "Outcome" },
          { key: "expiryAt" as SortKey, label: "Date" },
        ] as Array<{ key: SortKey | null; label: string }>).map(({ key, label }) => (
          <div key={label} className="flex items-center gap-1">
            {key ? (
              <button
                type="button"
                onClick={() => handleSort(key)}
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.07em] text-ink/55 hover:text-ink dark:text-white/45 dark:hover:text-white"
              >
                {label}
                <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
              </button>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.07em] text-ink/45 dark:text-white/35">
                {label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <svg width="70" height="70" viewBox="0 0 80 80" fill="none" aria-hidden="true" className="opacity-50">
            <circle cx="36" cy="36" r="24" stroke="#42db8d" strokeWidth="2.5" fill="none" />
            <circle cx="36" cy="36" r="2.5" fill="#42db8d" />
            <line x1="36" y1="36" x2="36" y2="22" stroke="#42db8d" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="36" y1="36" x2="46" y2="36" stroke="#f5ad32" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold">No results</p>
          <p className="text-xs text-ink/60 dark:text-white/50">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {paginated.map((loan) => (
            <HistoryRow
              key={loan.loanId}
              loan={loan}
              expanded={expandedLoanId === loan.loanId}
              onToggle={() => setExpandedLoanId((v) => (v === loan.loanId ? null : loan.loanId))}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-ink/5 disabled:opacity-40 dark:border-white/20"
          >
            ← Prev
          </button>
          <span className="text-xs text-ink/60 dark:text-white/50">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-ink/5 disabled:opacity-40 dark:border-white/20"
          >
            Next →
          </button>
        </div>
      ) : null}
    </section>
  );
}
