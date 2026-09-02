import { bigint, customType, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** bytea sloupec pro AES-256-GCM šifrovaný payload (§24, §31.6) — nikdy plaintext. */
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").unique(),
  telegramUserId: text("telegram_user_id").unique(),
  displayName: text("display_name").notNull(),
  recentReauthAt: timestamp("recent_reauth_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rawEvents = pgTable("raw_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  conversationSequence: bigint("conversation_sequence", { mode: "bigint" }).notNull(),
  inputSequence: bigint("input_sequence", { mode: "bigint" }),
  channel: text("channel").notNull(),
  externalEventId: text("external_event_id"),
  speaker: text("speaker").notNull(),
  payloadCiphertext: bytea("payload_ciphertext").notNull(),
  payloadType: text("payload_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  schemaVersion: integer("schema_version").notNull().default(1),
  encryptionKeyVersion: integer("encryption_key_version").notNull(),
});

export const messageProcessingJobs = pgTable("message_processing_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  rawEventId: uuid("raw_event_id")
    .notNull()
    .unique()
    .references(() => rawEvents.id),
  status: text("status").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  firstStartedAt: timestamp("first_started_at", { withTimezone: true }),
  processingDeadlineAt: timestamp("processing_deadline_at", { withTimezone: true }),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  processorId: text("processor_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  quarantineReason: text("quarantine_reason"),
  quarantineNoticeSentAt: timestamp("quarantine_notice_sent_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  lastErrorDetail: text("last_error_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ownerProcessingState = pgTable("owner_processing_state", {
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => owners.id),
  activeJobId: uuid("active_job_id").references(() => messageProcessingJobs.id),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  leaseEpoch: bigint("lease_epoch", { mode: "bigint" }).notNull().default(BigInt(0)),
  ownerControlEpoch: bigint("owner_control_epoch", { mode: "bigint" }).notNull().default(BigInt(0)),
  lastSettledInputSequence: bigint("last_settled_input_sequence", { mode: "bigint" }).notNull().default(BigInt(0)),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const responses = pgTable("responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  sourceRawEventId: uuid("source_raw_event_id")
    .notNull()
    .unique()
    .references(() => rawEvents.id),
  sourceInputSequence: bigint("source_input_sequence", { mode: "bigint" }).notNull(),
  responseKind: text("response_kind").notNull().default("BUDDY"),
  payloadCiphertext: bytea("payload_ciphertext").notNull(),
  encryptionKeyVersion: integer("encryption_key_version").notNull(),
  stance: text("stance"),
  llmRunId: uuid("llm_run_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const responseDeliveries = pgTable("response_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  responseId: uuid("response_id")
    .notNull()
    .references(() => responses.id),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("PENDING"),
  idempotencyKey: text("idempotency_key").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  externalMessageId: text("external_message_id"),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export { bytea };
export type OwnerRow = typeof owners.$inferSelect;
export type RawEventRow = typeof rawEvents.$inferSelect;
export type MessageProcessingJobRow = typeof messageProcessingJobs.$inferSelect;
