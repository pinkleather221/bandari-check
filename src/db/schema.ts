import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Raw uploaded files are never stored. Only the extracted fields and findings.
export const audits = sqliteTable("audits", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  mode: text("mode").notNull(),
  verdict: text("verdict").notNull(),
  score: integer("score").notNull(),
  blockers: integer("blockers").notNull(),
  warns: integer("warns").notNull(),
  infos: integer("infos").notNull(),
  containerNo: text("container_no"),
  exposureUsd: integer("exposure_usd").notNull(),
  sha256: text("sha256").notNull(),
  reportJson: text("report_json").notNull(),
  status: text("status").notNull().default("draft"),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at"),
});

// Append-only audit trail: who did what, when.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditId: text("audit_id").notNull(),
  at: integer("at").notNull(),
  action: text("action").notNull(),
  actor: text("actor"),
  detail: text("detail"),
});
