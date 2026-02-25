/**
 * API para marcar alerta como leida
 * =================================
 *
 * PUT /api/alerts/[id]/read
 * Marca una alerta especifica como leida
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/alerts/[id]/read
 * Marca una alerta como leida
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar que la alerta existe y pertenece al tenant del usuario
    const alert = await prisma.alert.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alerta no encontrada" },
        { status: 404 }
      );
    }

    // Marcar como leida
    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: updatedAlert.id,
        type: updatedAlert.type,
        message: updatedAlert.message,
        read: updatedAlert.read,
        readAt: updatedAlert.readAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error marcando alerta como leida:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
