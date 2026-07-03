CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`attempts` integer DEFAULT 1,
	`first_attempt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_ip` ON `login_attempts` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_login_attempts_first_attempt` ON `login_attempts` (`first_attempt`);
