export type TxStatus = "pending" | "confirmed" | "failed";

export interface TxRecord {
  id: string;
  label: string;
  txHash: string;
  status: TxStatus;
  timestamp: number; // unix seconds
  explorerUrl: string;
}

const STORAGE_KEY = "flashdot_tx_history";
const MAX_ENTRIES = 20;

export function getTxHistory(): TxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TxRecord[]) : [];
  } catch {
    return [];
  }
}

export function addTxRecord(record: Omit<TxRecord, "id">): void {
  const history = getTxHistory();
  const entry: TxRecord = { ...record, id: crypto.randomUUID() };
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function updateTxStatus(txHash: string, status: TxStatus): void {
  const history = getTxHistory();
  const updated = history.map((tx) =>
    tx.txHash === txHash ? { ...tx, status } : tx
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}
