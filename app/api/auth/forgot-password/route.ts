import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requerido" },
        { status: 400 }
      );
    }

    // Verificar si existe el usuario
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Por seguridad, siempre retornamos éxito aunque el usuario no exista
    // Esto previene enumeración de usuarios
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generar token seguro
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    // Guardar token en la base de datos
    await prisma.passwordResetToken.create({
      data: {
        email: email.toLowerCase(),
        token,
        expires,
      },
    });

    // Construir URL de reset
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // En desarrollo, loguear el enlace
    if (process.env.NODE_ENV !== "production") {
      console.log("=".repeat(60));
      console.log("PASSWORD RESET LINK (desarrollo):");
      console.log(resetUrl);
      console.log("=".repeat(60));
    }

    // En producción, enviar email si hay SMTP configurado
    if (process.env.SMTP_HOST && process.env.NODE_ENV === "production") {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || "noreply@tradingbot.com",
          to: email,
          subject: "Restablecer contraseña - Trading Bot",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Restablecer tu contraseña</h2>
              <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0078D4; color: white; text-decoration: none; border-radius: 6px;">
                Restablecer Contraseña
              </a>
              <p style="margin-top: 20px; color: #666;">
                Este enlace expirará en 1 hora. Si no solicitaste este email, puedes ignorarlo.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Error enviando email:", emailError);
        // No revelamos el error al usuario por seguridad
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
