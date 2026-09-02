import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners } from "./core";
import { domains } from "./context";

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  domainId: uuid("domain_id").references(() => domains.id),
  question: text("question").notNull(),
  hypothesis: text("hypothesis"),
  status: text("status").notNull().default("DRAFT"),
  checkinRule: jsonb("checkin_rule"),
  objectiveMetrics: jsonb("objective_metrics").notNull().default([]),
  subjectiveMetrics: jsonb("subjective_metrics").notNull().default([]),
  verdict: text("verdict"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const experimentObservations = pgTable("experiment_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  isNoData: boolean("is_no_data").notNull().default(false),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
