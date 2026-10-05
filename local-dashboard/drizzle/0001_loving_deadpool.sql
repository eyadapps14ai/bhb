CREATE TABLE `leases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`office_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lease_owner_office` ON `leases` (`owner`,`office_id`);