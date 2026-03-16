import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const loans = sqliteTable("loans", {
  loanId: text("loan_id").primaryKey(),
  borrower: text("borrower").notNull(),
  state: integer("state").notNull(),
  bondAmount: text("bond_amount").notNull(),
  expiryAt: integer("expiry_at", { mode: "number" }).notNull(),
  repayOnlyMode: integer("repay_only_mode", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const legs = sqliteTable(
  "legs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loanId: text("loan_id").notNull(),
    legId: integer("leg_id").notNull(),
    chain: text("chain").notNull(),
    vault: text("vault").notNull(),
    amount: text("amount").notNull(),
    state: integer("state").notNull(),
    lastXcmQueryId: text("last_xcm_query_id"),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    loanLegUnique: uniqueIndex("legs_loan_leg_unique").on(table.loanId, table.legId),
  })
);

export const retryQueue = sqliteTable("retry_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loanId: text("loan_id"),
  legId: integer("leg_id"),
  action: text("action").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: integer("next_retry_at", { mode: "number" }).notNull(),
  lastError: text("last_error"),
  payload: text("payload"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const xcmEvents = sqliteTable("xcm_events", {
  queryId: text("query_id").primaryKey(),
  loanId: text("loan_id").notNull(),
  legId: integer("leg_id").notNull(),
  phase: text("phase").notNull(),
  txHash: text("tx_hash"),
  logIndex: integer("log_index"),
  sentAt: integer("sent_at", { mode: "number" }).notNull(),
  ackedAt: integer("acked_at", { mode: "number" }),
}, (table) => ({
  receiptUnique: uniqueIndex("xcm_events_tx_hash_log_index_unique").on(table.txHash, table.logIndex),
}));

export const schema = {
  loans,
  legs,
  retryQueue,
  xcmEvents,
};
