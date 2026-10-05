CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`office_id` text NOT NULL,
	`payment_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `document_owner` ON `documents` (`owner`);--> statement-breakpoint
CREATE INDEX `document_office` ON `documents` (`office_id`);--> statement-breakpoint
CREATE TABLE `offices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `office_owner_code` ON `offices` (`owner`,`code`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`office_id` text,
	`data` text NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_owner` ON `payments` (`owner`);--> statement-breakpoint
CREATE INDEX `payment_office` ON `payments` (`office_id`);