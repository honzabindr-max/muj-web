import { NextResponse } from "next/server";

import { getH2Config, H2ConfigError } from "@/h2/config";
import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getH2Config();
    logH2Event({ purpose: "health", status: "ok" });
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
    if (error instanceof H2ConfigError) {
      logH2Event({ purpose: "health", status: "error", errorCode: "H2_CONFIG_INVALID" });
      return NextResponse.json(
        { status: "error", errorCode: "H2_CONFIG_INVALID", missingKeys: error.missingKeys },
        { status: 500 },
      );
    }
    logH2Event({ purpose: "health", status: "error", errorCode: "H2_HEALTH_UNKNOWN_ERROR" });
    return NextResponse.json(
      { status: "error", errorCode: "H2_HEALTH_UNKNOWN_ERROR" },
      { status: 500 },
    );
  }
}
