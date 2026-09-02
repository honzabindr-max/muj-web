import { NextResponse } from "next/server";

import { getH2Config, H2ConfigError } from "@/h2/config";
import { isAuthenticatedOwnerRequest } from "@/h2/identity/owner-session";
import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const isOwner = isAuthenticatedOwnerRequest(request);

  try {
    const config = getH2Config();
    logH2Event({ purpose: "health", status: "ok" });

    if (!isOwner) {
      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({
      status: "ok",
      environment: config.environment,
      models: config.models,
      capabilities: config.capabilities,
      featureFlags: config.featureFlags,
      buildInfo: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorCode = error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_HEALTH_UNKNOWN_ERROR";
    logH2Event({ purpose: "health", status: "error", errorCode });

    if (!isOwner) {
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    const missingKeys = error instanceof H2ConfigError ? error.missingKeys : undefined;
    return NextResponse.json({ status: "error", errorCode, missingKeys }, { status: 500 });
  }
}
