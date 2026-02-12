import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Crear tenant
    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
      },
    });

    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario asociado al tenant
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        tenantId: tenant.id,
      },
    });

    return NextResponse.json(
      { message: "Usuario creado exitosamente", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}
