CREATE TABLE `employees` (
	`nik` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nik` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`shift` text NOT NULL,
	FOREIGN KEY (`nik`) REFERENCES `employees`(`nik`) ON UPDATE no action ON DELETE no action
);
