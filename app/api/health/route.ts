import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health Check Endpoint
 * Usado por Docker y monitoring para verificar estado de la aplicacion
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Verificar conexion a base de datos
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      responseTime: `${responseTime}ms`,
      version: process.env.npm_package_version || '0.1.0',
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime}ms`,
      },
      { status: 503 }
    );
  }
}
