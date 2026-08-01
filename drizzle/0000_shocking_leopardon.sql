CREATE TABLE `prototype_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`target_url` text NOT NULL,
	`goal` text NOT NULL,
	`persona_ids` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
