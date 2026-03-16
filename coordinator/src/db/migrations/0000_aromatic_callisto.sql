CREATE TABLE `legs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` text NOT NULL,
	`leg_id` integer NOT NULL,
	`chain` text NOT NULL,
	`vault` text NOT NULL,
	`amount` text NOT NULL,
	`state` integer NOT NULL,
	`last_xcm_query_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legs_loan_leg_unique` ON `legs` (`loan_id`,`leg_id`);--> statement-breakpoint
CREATE TABLE `loans` (
	`loan_id` text PRIMARY KEY NOT NULL,
	`borrower` text NOT NULL,
	`state` integer NOT NULL,
	`bond_amount` text NOT NULL,
	`expiry_at` integer NOT NULL,
	`repay_only_mode` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retry_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` text,
	`leg_id` integer,
	`action` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_retry_at` integer NOT NULL,
	`last_error` text,
	`payload` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xcm_events` (
	`query_id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`leg_id` integer NOT NULL,
	`phase` text NOT NULL,
	`tx_hash` text,
	`log_index` integer,
	`sent_at` integer NOT NULL,
	`acked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xcm_events_tx_hash_log_index_unique` ON `xcm_events` (`tx_hash`,`log_index`);
