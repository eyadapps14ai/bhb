CREATE TABLE `employee_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `employee_request_owner` ON `employee_requests` (`owner`);