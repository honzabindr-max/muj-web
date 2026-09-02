import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners, rawEvents } from "./core";

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  purpose: text("purpose").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("DRAFT"),
  content: text("content").notNull(),
  outputSchema: jsonb("output_schema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});

export const promptTestRuns = pgTable("prompt_test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptVersionId: uuid("prompt_version_id")
    .notNull()
    .references(() => promptVersions.id),
  modelId: text("model_id").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  fixtureSetVersion: text("fixture_set_version").notNull(),
  status: text("status").notNull(),
  results: jsonb("results"),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmRuns = pgTable("llm_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  purpose: text("purpose").notNull(),
  modelId: text("model_id").notNull(),
  promptVersionId: uuid("prompt_version_id").references(() => promptVersions.id),
  extractorVersion: text("extractor_version"),
  schemaVersion: integer("schema_version"),
  inputReferenceManifest: jsonb("input_reference_manifest"),
  inputTokenCount: integer("input_token_count"),
  outputTokenCount: integer("output_token_count"),
  latencyMs: integer("latency_ms"),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalExtractions = pgTable("operational_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  rawEventId: uuid("raw_event_id")
    .notNull()
    .references(() => rawEvents.id),
  llmRunId: uuid("llm_run_id")
    .notNull()
    .references(() => llmRuns.id),
  extractorVersion: text("extractor_version").notNull(),
  output: jsonb("output").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blindExtractions = pgTable("blind_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  rawEventId: uuid("raw_event_id")
    .notNull()
    .references(() => rawEvents.id),
  llmRunId: uuid("llm_run_id")
    .notNull()
    .references(() => llmRuns.id),
  extractorVersion: text("extractor_version").notNull(),
  inputReferenceManifest: jsonb("input_reference_manifest").notNull(),
  output: jsonb("output").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
