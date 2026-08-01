CREATE TABLE `prototype_personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`traits_json` text NOT NULL,
	`accessibility` text,
	`patience` integer NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `success_criteria` text DEFAULT 'Journey completes successfully.' NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `ux_score` integer;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `completion_rate` integer;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `friction_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `events_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `findings_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `tickets_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_runs` ADD `completed_at` text;