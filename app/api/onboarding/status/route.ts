/**
 * API de Onboarding - Estado
 * ==========================
 *
 * GET: Obtiene el estado actual del proceso de onboarding
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { needsImplementationFee } from "@/lib/plans";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: { include: { plan: true } } },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const tenant = user.tenant;
    const feeStatus = await needsImplementationFee(tenant.id);

    return NextResponse.json({
      success: true,
      planName: tenant.plan?.name || "Sin plan",
      planId: tenant.planId,
      implementationFeePaid: tenant.implementationFeePaid,
      needsImplementationFee: feeStatus.required,
      implementationFeeAmount: feeStatus.amount,
      vpsAccessGranted: tenant.vpsAccessGranted,
      onboardingCompleted: tenant.onboardingCompletedAt !== null,
    });
  } catch (error) {
    console.error("Error obteniendo estado de onboarding:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
