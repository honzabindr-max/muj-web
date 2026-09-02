import { bigint, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners, responses } from "./core";

export const proactivityEvents = pgTable("proactivity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  whyNowReason: text("why_now_reason").notNull(),
  responseId: uuid("response_id").references(() => responses.id),
  outcome: text("outcome").notNull().default("sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobDefinitions = pgTable("job_definitions", {
  jobName: text("job_name").primaryKey(),
  scheduleKind: text("schedule_kind").notNull(),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }),
  lastDueAt: timestamp("last_due_at", { withTimezone: true }),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastSucceededAt: timestamp("last_succeeded_at", { withTimezone: true }),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
  healthGraceSeconds: integer("health_grace_seconds").notNull(),
});

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name")
    .notNull()
    .references(() => jobDefinitions.jobName),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("CLAIMED"),
  claimedBy: text("claimed_by"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => owners.id),
  incidentType: text("incident_type").notNull(),
  severity: text("severity").notNull().default("WARNING"),
  detailCode: text("detail_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const usageLedger = pgTable("usage_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  purpose: text("purpose").notNull(),
  modelId: text("model_id"),
  unit: text("unit").notNull(),
  quantity: numeric("quantity").notNull(),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pricingCatalog = pgTable("pricing_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: text("resource").notNull(),
  unit: text("unit").notNull(),
  unitPriceUsd: numeric("unit_price_usd", { precision: 12, scale: 6 }).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerPolicyCatalog = pgTable("provider_policy_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  policyUrl: text("policy_url").notNull(),
  retentionStatement: text("retention_statement").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const backupRuns = pgTable("backup_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  backupType: text("backup_type").notNull(),
  status: text("status").notNull().default("RUNNING"),
  sizeBytes: bigint("size_bytes", { mode: "bigint" }),
  errorCode: text("error_code"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const encryptionRotationRuns = pgTable("encryption_rotation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyVersionFrom: integer("key_version_from").notNull(),
  keyVersionTo: integer("key_version_to").notNull(),
  status: text("status").notNull().default("RUNNING"),
  rowsTotal: bigint("rows_total", { mode: "bigint" }),
  rowsMigrated: bigint("rows_migrated", { mode: "bigint" }).default(BigInt(0)),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});
