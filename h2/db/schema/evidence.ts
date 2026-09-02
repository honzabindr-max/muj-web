import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners } from "./core";
import { domains } from "./context";
import { actionExecutions } from "./executive";
import { responses } from "./core";

export const evidenceItems = pgTable("evidence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  rawEventId: uuid("raw_event_id"),
  personId: uuid("person_id"),
  evidenceType: text("evidence_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  supersededById: uuid("superseded_by_id"),
  correctedById: uuid("corrected_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  domainId: uuid("domain_id").references(() => domains.id),
  statement: text("statement").notNull(),
  state: text("state").notNull().default("HYPOTEZA"),
  independentSupportCount: integer("independent_support_count").notNull().default(0),
  independentContradictionCount: integer("independent_contradiction_count").notNull().default(0),
  influencedCount: integer("influenced_count").notNull().default(0),
  unknownCount: integer("unknown_count").notNull().default(0),
  retestAt: timestamp("retest_at", { withTimezone: true }),
  supersededById: uuid("superseded_by_id"),
  correctedById: uuid("corrected_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const claimEvidence = pgTable("claim_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  evidenceItemId: uuid("evidence_item_id")
    .notNull()
    .references(() => evidenceItems.id),
  relation: text("relation").notNull(),
  independence: text("independence").notNull().default("UNKNOWN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const derivationEdges = pgTable("derivation_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  fromNodeType: text("from_node_type").notNull(),
  fromNodeId: uuid("from_node_id").notNull(),
  toNodeType: text("to_node_type").notNull(),
  toNodeId: uuid("to_node_id").notNull(),
  relationType: text("relation_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const influenceEdges = pgTable("influence_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  responseId: uuid("response_id").references(() => responses.id),
  actionExecutionId: uuid("action_execution_id").references(() => actionExecutions.id),
  relationType: text("relation_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mechanisms = pgTable("mechanisms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  domainId: uuid("domain_id").references(() => domains.id),
  claimId: uuid("claim_id").references(() => claims.id),
  statement: text("statement").notNull(),
  scope: text("scope"),
  conditions: jsonb("conditions").notNull().default([]),
  counterexamples: jsonb("counterexamples").notNull().default([]),
  failureMode: text("failure_mode"),
  recovery: text("recovery"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
