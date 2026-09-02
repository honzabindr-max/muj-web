import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { bytea, owners } from "./core";

export const calendarAccounts = pgTable("calendar_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  provider: text("provider").notNull().default("google"),
  oauthTokensCiphertext: bytea("oauth_tokens_ciphertext").notNull(),
  encryptionKeyVersion: integer("encryption_key_version").notNull(),
  scopes: jsonb("scopes").notNull().default([]),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const calendarEventCache = pgTable("calendar_event_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  calendarAccountId: uuid("calendar_account_id")
    .notNull()
    .references(() => calendarAccounts.id),
  externalEventId: text("external_event_id").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  payloadCiphertext: bytea("payload_ciphertext").notNull(),
  encryptionKeyVersion: integer("encryption_key_version").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});
