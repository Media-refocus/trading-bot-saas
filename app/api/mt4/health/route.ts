/**
 * API MT4 - Health Check
 * =======================
 *
 * GET: Verifica que el EA puede conectar con el SaaS
 */

import { NextRequest, NextResponse } from "next/server";
import { validateMt4Access } from "@/lib/plans";

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("apiKey");

  // Validar API key y suscripción activa
  const access = await validateMt4Access(apiKey || "");

  if (!access.valid) {
    return NextResponse.json(
      {
        status: "error",
        error: access.error,
        timestamp: new Date().toISOString(),
      },
      { status: access.statusCode || 401 }
    );
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
    planName: access.botConfig?.tenant?.plan?.name,
  });
}
