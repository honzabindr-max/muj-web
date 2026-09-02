import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners } from "./core";
import { domains } from "./context";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  name: text("name").notNull(),
  purpose: text("purpose"),
  status: text("status").notNull().default("IDEA"),
  successDefinition: text("success_definition"),
  milestone: text("milestone"),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priorities = pgTable("priorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commitments = pgTable("commitments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  projectId: uuid("project_id").references(() => projects.id),
  statement: text("statement").notNull(),
  reason: text("reason"),
  createdByUser: boolean("created_by_user").notNull(),
  scope: text("scope"),
  expiresOnEvent: text("expires_on_event"),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  buddyCanRemind: boolean("buddy_can_remind").notNull().default(false),
  buddyCanProtect: boolean("buddy_can_protect").notNull().default(false),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const openLoops = pgTable("open_loops", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  projectId: uuid("project_id").references(() => projects.id),
  domainId: uuid("domain_id").references(() => domains.id),
  commitmentId: uuid("commitment_id").references(() => commitments.id),
  loopType: text("loop_type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("OPEN"),
  returnAt: timestamp("return_at", { withTimezone: true }),
  returnCondition: text("return_condition"),
  parkedReason: text("parked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("OPEN"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  taskId: uuid("task_id").references(() => tasks.id),
  commitmentId: uuid("commitment_id").references(() => commitments.id),
  openLoopId: uuid("open_loop_id").references(() => openLoops.id),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const actionPermissions = pgTable("action_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  integration: text("integration").notNull(),
  capability: text("capability").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  grantedViaReauthAt: timestamp("granted_via_reauth_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const actionExecutions = pgTable("action_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  actionType: text("action_type").notNull(),
  integration: text("integration").notNull(),
  capabilityRequired: text("capability_required").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  commitmentId: uuid("commitment_id").references(() => commitments.id),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
