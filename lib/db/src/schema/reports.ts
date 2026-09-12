import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const reportsTable = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  irrigatorType: varchar("irrigator_type"),
  farmName: varchar("farm_name"),
  assessorName: varchar("assessor_name"),
  testDate: varchar("test_date"),
  reportData: jsonb("report_data").notNull(),
  duPercent: varchar("du_percent"),
  duStatus: varchar("du_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertReport = typeof reportsTable.$inferInsert;
export type Report = typeof reportsTable.$inferSelect;

export const helpRequestsTable = pgTable("help_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  description: text("description").notNull(),
  contactInfo: varchar("contact_info"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertHelpRequest = typeof helpRequestsTable.$inferInsert;
export type HelpRequest = typeof helpRequestsTable.$inferSelect;

export const feedbackTable = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  message: text("message").notNull(),
  contactInfo: varchar("contact_info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertFeedback = typeof feedbackTable.$inferInsert;
export type Feedback = typeof feedbackTable.$inferSelect;
