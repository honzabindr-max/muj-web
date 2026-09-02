import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { owners } from "./core";

export const identityAuditEvents = pgTable("identity_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => owners.id),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
