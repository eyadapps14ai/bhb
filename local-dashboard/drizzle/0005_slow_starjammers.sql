CREATE TABLE `invoice_issuers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`office_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_id_unique` ON `invoices` (`id`);--> statement-breakpoint
CREATE INDEX `invoice_owner` ON `invoices` (`owner`);