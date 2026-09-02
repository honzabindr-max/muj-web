import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners } from "./core";
import { llmRuns } from "./prompts";

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  definition: text("definition").notNull(),
  canonicalQuestions: jsonb("canonical_questions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contextPacks = pgTable("context_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  summary: jsonb("summary").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contextRuns = pgTable("context_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  llmRunId: uuid("llm_run_id").references(() => llmRuns.id),
  purpose: text("purpose").notNull(),
  inputTokensEstimated: integer("input_tokens_estimated").notNull(),
  inputTokensActual: integer("input_tokens_actual"),
  maxInputTokens: integer("max_input_tokens").notNull(),
  maxOutputTokens: integer("max_output_tokens").notNull(),
  outputTokensActual: integer("output_tokens_actual"),
  omissionReason: text("omission_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contextRunItems = pgTable("context_run_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  contextRunId: uuid("context_run_id")
    .notNull()
    .references(() => contextRuns.id),
  itemType: text("item_type").notNull(),
  itemId: uuid("item_id").notNull(),
  priority: text("priority").notNull(),
  included: boolean("included").notNull(),
  personId: uuid("person_id"),
  reason: text("reason"),
});
