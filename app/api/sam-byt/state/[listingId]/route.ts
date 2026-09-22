import { NextResponse, type NextRequest } from "next/server";

import { verifySameOrigin } from "@/sam-byt/auth/csrf";
import { getSessionUser } from "@/sam-byt/auth/require-session";
import { isValidListingId } from "@/sam-byt/data/listings";
import { getSamBytPool } from "@/sam-byt/db/pool";
import { applyStateMutation, type StatePatch } from "@/sam-byt/state/repository";
import { DECISIONS, type ListingId } from "@/sam-byt/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTES_LENGTH = 2000;

function isValidRating(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ listingId: string }> }) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { listingId } = await context.params;
  if (!isValidListingId(listingId)) {
    return NextResponse.json({ error: "unknown_listing" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof body.expectedVersion !== "number" || body.expectedVersion < 0) {
    return NextResponse.json({ error: "missing_expected_version" }, { status: 400 });
  }

  const patch: StatePatch = {};
  if ("favorite" in body) {
    if (typeof body.favorite !== "boolean") {
      return NextResponse.json({ error: "invalid_favorite" }, { status: 400 });
    }
    patch.favorite = body.favorite;
  }
  if ("decision" in body) {
    if (typeof body.decision !== "string" || !DECISIONS.includes(body.decision as (typeof DECISIONS)[number])) {
      return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
    }
    patch.decision = body.decision as StatePatch["decision"];
  }
  if ("notes" in body) {
    if (typeof body.notes !== "string" || body.notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: "invalid_notes" }, { status: 400 });
    }
    patch.notes = body.notes;
  }
  for (const field of ["ratingPrice", "ratingPet", "ratingLocation", "ratingBalcony", "ratingFurnishing"] as const) {
    if (field in body) {
      if (!isValidRating(body[field])) {
        return NextResponse.json({ error: `invalid_${field}` }, { status: 400 });
      }
      patch[field] = body[field] as number | null;
    }
  }

  const pool = getSamBytPool();
  const result = await applyStateMutation(
    pool,
    sessionUser.userId,
    sessionUser.username,
    listingId as ListingId,
    patch,
    body.expectedVersion,
  );

  if (!result.ok) {
    return NextResponse.json({ error: "version_conflict", current: result.current }, { status: 409 });
  }
  return NextResponse.json({ state: result.state });
}
