"use client";

import { Activity, Globe, TrendingUp, Zap } from "lucide-react";

import { DashboardView } from "../components/DashboardView";
import { useWallet } from "../hooks/useWallet";
import { useProtocolStats } from "../hooks/useProtocolStats";
import {
  INTEREST_LABEL,
  MOCK_LIQUIDITY_A,
  MOCK_LIQUIDITY_B,
} from "../hooks/useCreateLoan";
import { VAULT_A_ADDRESS, VAULT_B_ADDRESS, EXPLORER_TX_URL } from "../lib/contracts";

function shortAddress(address: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerAddressUrl(address: string): string {
  return EXPLORER_TX_URL("").replace("/tx/", `/address/${address}`);
}

export default function HomePage(): JSX.Element {
  const { account, isConnected } = useWallet();

  if (isConnected && account) {
    return <DashboardView account={account} />;
  }

  return <ProtocolDashboard />;
}

function ProtocolDashboard(): JSX.Element {
  const stats = useProtocolStats();

  const vaults = [
    {
      label: "Parachain Alpha",
      address: VAULT_A_ADDRESS,
      liquidity: MOCK_LIQUIDITY_A,
      utilization: "12%",
      accent: "primary" as const,
    },
    {
      label: "Parachain Beta",
      address: VAULT_B_ADDRESS,
      liquidity: MOCK_LIQUIDITY_B,
      utilization: "8%",
      accent: "info" as const,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 animate-content-fade">
      {/* Protocol KPIs */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-ink dark:text-white">
          Protocol Overview
        </h1>
        <p className="mt-0.5 text-sm text-ink/60 dark:text-white/50">
          Polkadot Hub EVM Testnet · Bonded cross-chain flash loans
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Zap size={18} />}
          label="Total Loans"
          value={stats.totalLoans !== null ? String(stats.totalLoans) : "—"}
          sub="all time"
          accent="primary"
          loading={stats.loading}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Active Loans"
          value={stats.activeLoans !== null ? String(stats.activeLoans) : "—"}
          sub="in progress"
          accent="info"
          loading={stats.loading}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Success Rate"
          value={stats.successRate !== null ? `${stats.successRate}%` : "—"}
          sub="settled / total closed"
          accent="success"
          loading={stats.loading}
        />
      </div>

      {/* Vault info */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.07em] text-ink/55 dark:text-white/50">
          Available Vaults
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {vaults.map((vault) => (
            <VaultCard key={vault.label} {...vault} />
          ))}
        </div>
      </div>

      {/* Connect CTA */}
      <div className="mt-8 rounded-2xl border border-ink/10 bg-white/60 p-6 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold text-ink/80 dark:text-white/70">
          Connect your wallet to create flash loans and view your positions
        </p>
        <p className="mt-1 text-xs text-ink/50 dark:text-white/40">
          Requires MetaMask on Polkadot Hub EVM Testnet
        </p>
      </div>
    </main>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: "primary" | "info" | "success";
  loading?: boolean;
}

function StatCard({ icon, label, value, sub, accent, loading }: StatCardProps): JSX.Element {
  const accentMap = {
    primary: "text-primary",
    info: "text-info",
    success: "text-success",
  };
  return (
    <div className="elevation-1 elevation-hover-lift rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <div className={`${accentMap[accent]} shrink-0`}>{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-ink/55 dark:text-white/50">
          {label}
        </p>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
      ) : (
        <p className="type-h2 mt-2 font-mono text-ink dark:text-white">{value}</p>
      )}
      <p className="mt-0.5 text-xs text-ink/55 dark:text-white/45">{sub}</p>
    </div>
  );
}

interface VaultCardProps {
  label: string;
  address: string;
  liquidity: string;
  utilization: string;
  accent: "primary" | "info";
}

function VaultCard({ label, address, liquidity, utilization, accent }: VaultCardProps): JSX.Element {
  const isBorderPrimary = accent === "primary";
  const utilizationNum = parseFloat(utilization);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        isBorderPrimary
          ? "border-primary/20 bg-primary/5 dark:border-primary/15 dark:bg-primary/8"
          : "border-info/20 bg-info/5 dark:border-info/15 dark:bg-info/8"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          isBorderPrimary ? "bg-primary" : "bg-info"
        }`}
      />
      <div className="pl-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid h-8 w-8 place-items-center rounded-xl ${
              isBorderPrimary ? "bg-primary/15" : "bg-info/15"
            }`}
          >
            <Globe
              size={14}
              className={isBorderPrimary ? "text-primary" : "text-info"}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            {address ? (
              <a
                href={explorerAddressUrl(address)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[10px] text-ink/45 transition hover:text-ink/70 dark:text-white/40 dark:hover:text-white/60"
              >
                {shortAddress(address)} ↗
              </a>
            ) : (
              <p className="font-mono text-[10px] text-ink/45 dark:text-white/40">
                Not configured
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-ink/50 dark:text-white/45">Liquidity</p>
            <p className="mt-0.5 font-semibold">{liquidity}</p>
          </div>
          <div>
            <p className="text-ink/50 dark:text-white/45">Interest</p>
            <p className="mt-0.5 font-semibold">{INTEREST_LABEL}</p>
          </div>
          <div>
            <p className="text-ink/50 dark:text-white/45">Utilization</p>
            <p
              className={`mt-0.5 font-semibold ${
                utilizationNum > 80
                  ? "text-danger"
                  : utilizationNum > 50
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {utilization}
            </p>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              utilizationNum > 80
                ? "bg-danger"
                : utilizationNum > 50
                  ? "bg-warning"
                  : isBorderPrimary
                    ? "bg-primary"
                    : "bg-info"
            }`}
            style={{ width: utilization }}
          />
        </div>
      </div>
    </div>
  );
}
