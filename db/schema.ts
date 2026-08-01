import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const prototypeRuns = sqliteTable("prototype_runs", {
  id: text("id").primaryKey(),
  projectName: text("project_name").notNull(),
  targetUrl: text("target_url").notNull(),
  goal: text("goal").notNull(),
  personaIds: text("persona_ids").notNull(),
  status: text("status").notNull().default("QUEUED"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
