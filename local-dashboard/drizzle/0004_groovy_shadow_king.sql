CREATE TABLE `email_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_connection_owner` ON `email_connections` (`owner`);