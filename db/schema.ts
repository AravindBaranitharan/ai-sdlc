import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const prototypeRuns = sqliteTable("prototype_runs", {
  id: text("id").primaryKey(),
  projectName: text("project_name").notNull(),
  targetUrl: text("target_url").notNull(),
  goal: text("goal").notNull(),
  successCriteria: text("success_criteria").notNull().default("Journey completes successfully."),
  personaIds: text("persona_ids").notNull(),
  status: text("status").notNull().default("QUEUED"),
  progress: integer("progress").notNull().default(0),
  uxScore: integer("ux_score"),
  completionRate: integer("completion_rate"),
  frictionCount: integer("friction_count").notNull().default(0),
  eventsJson: text("events_json").notNull().default("[]"),
  findingsJson: text("findings_json").notNull().default("[]"),
  ticketsJson: text("tickets_json").notNull().default("[]"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const prototypePersonas = sqliteTable("prototype_personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  traitsJson: text("traits_json").notNull(),
  accessibility: text("accessibility"),
  patience: integer("patience").notNull(),
  confidence: integer("confidence").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
