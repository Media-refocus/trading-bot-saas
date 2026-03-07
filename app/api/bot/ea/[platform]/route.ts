/**
 * GET /api/bot/ea/[platform]
 *
 * Descarga el EA precompilado para MT4 o MT5.
 * Requiere autenticación con API key válida.
 *
 * @param platform - "mt4" o "mt5"
 * @returns Archivo .ex4 o .ex5
 */

import { NextRequest } from "next/server";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";
import {
  authenticateBot,
  botErrorResponse,
} from "../../auth";

const EA_VERSION = "1.0.0";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Validar plataforma
  if (platform !== "mt4" && platform !== "mt5") {
    return botErrorResponse(
      "Invalid platform. Use 'mt4' or 'mt5'.",
      400,
      "INVALID_PLATFORM"
    );
  }

  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  // Determinar archivo según plataforma
  const fileName = platform === "mt4" ? "TBSSignalEA.ex4" : "TBSSignalEA.ex5";
  const filePath = path.join(process.cwd(), "public", "eas", fileName);

  // Verificar que el archivo existe
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return botErrorResponse(
      `EA file not found: ${fileName}. Please contact support.`,
      404,
      "EA_NOT_FOUND"
    );
  }

  // Leer archivo
  const fileBuffer = await readFile(filePath);

  // Determinar content type
  const contentType = platform === "mt4"
    ? "application/octet-stream"
    : "application/octet-stream";

  // Retornar archivo con headers apropiados
  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": fileBuffer.length.toString(),
      "X-EA-Version": EA_VERSION,
      "X-EA-Platform": platform.toUpperCase(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
