import { bigint, customType, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** Žije v samostatné h2-control databázi (jiný Neon projekt, jiné credentials než h2-runtime). */
export const deletionLedger = pgTable("deletion_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  deletionId: uuid("deletion_id").notNull(),
  recordType: text("record_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  scopeType: text("scope_type"),
  targetSelectorHmac: bytea("target_selector_hmac"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  requestedBy: text("requested_by"),
  manifestVersion: bigint("manifest_version", { mode: "bigint" }).notNull(),
  hmacKeyVersion: integer("hmac_key_version").notNull(),
  previousRecordHash: bytea("previous_record_hash"),
  recordHash: bytea("record_hash").notNull(),
});
