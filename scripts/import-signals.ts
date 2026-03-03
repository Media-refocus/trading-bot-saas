/**
 * Script para importar señales históricas desde CSV a Supabase
 *
 * Lee signals_parsed.csv y los importa a la tabla Signal
 * - Batch inserts para rendimiento
 * - Skip duplicados (por tenantId + messageId + receivedAt)
 * - Log detallado de progreso
 *
 * Uso: npx tsx scripts/import-signals.ts [--dry-run] [--file=signals_parsed.csv]
 */

import { PrismaClient, Signal } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Configuración
const DEFAULT_FILE = "signals_parsed.csv";
const BATCH_SIZE = 100; // Signals por batch
const DEFAULT_TENANT_EMAIL = "guillermolhl@hotmail.com"; // Tenant por defecto

interface CsvSignal {
  ts_utc: string;
  kind: "range_open" | "range_close";
  side: "BUY" | "SELL" | "";
  price_hint: number | null;
  range_id: string;
  message_id: string;
  confidence: number;
  signal_number?: string;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}

function parseCsvLine(line: string): CsvSignal | null {
  const parts = line.split(";").map((p) => p.trim());

  if (parts.length < 7) return null;

  const [ts_utc, kind, side, price_hint, range_id, message_id, confidence, signal_number] = parts;

  return {
    ts_utc,
    kind: kind as "range_open" | "range_close",
    side: side as "BUY" | "SELL" | "",
    price_hint: price_hint ? parseFloat(price_hint) : null,
    range_id,
    message_id,
    confidence: confidence ? parseFloat(confidence) : 0,
    signal_number,
  };
}

function buildMessageText(signal: CsvSignal): string {
  if (signal.kind === "range_close") {
    return `[CLOSE] Range ${signal.range_id} closed`;
  }

  const side = signal.side || "UNKNOWN";
  const price = signal.price_hint ? signal.price_hint.toFixed(2) : "N/A";
  return `XAUUSD ${side} @ ${price} | Range: ${signal.range_id} | Conf: ${signal.confidence}`;
}

async function main() {
  // Parsear argumentos
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  let csvFile = DEFAULT_FILE;
  const fileArg = args.find((a) => a.startsWith("--file="));
  if (fileArg) {
    csvFile = fileArg.split("=")[1];
  }

  let tenantEmail = DEFAULT_TENANT_EMAIL;
  const tenantArg = args.find((a) => a.startsWith("--tenant="));
  if (tenantArg) {
    tenantEmail = tenantArg.split("=")[1];
  }

  const csvPath = path.resolve(process.cwd(), csvFile);

  console.log("=== Import Signals to Supabase ===\n");
  console.log(`📁 CSV file: ${csvPath}`);
  console.log(`🔍 Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will insert)"}\n`);

  // Verificar que el archivo existe
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  // Buscar tenant
  console.log(`📧 Buscando tenant con email: ${tenantEmail}`);
  const tenant = await prisma.tenant.findFirst({
    where: { email: tenantEmail },
  });

  if (!tenant) {
    console.error(`❌ No se encontró tenant con email ${DEMO_EMAIL}`);
    console.log("💡 Crea primero el usuario con scripts/create-test-user.ts");
    process.exit(1);
  }

  console.log(`✅ Tenant encontrado: ${tenant.id} (${tenant.name})\n`);

  // Leer CSV
  console.log("📖 Leyendo CSV...");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Saltar header
  const dataLines = lines.slice(1);
  console.log(`   Total líneas: ${dataLines.length}\n`);

  // Parsear señales
  const signals: CsvSignal[] = [];
  for (const line of dataLines) {
    const parsed = parseCsvLine(line);
    if (parsed) {
      signals.push(parsed);
    }
  }

  console.log(`   Señales parseadas: ${signals.length}`);

  // Obtener señales existentes para evitar duplicados
  console.log("\n🔍 Buscando señales existentes...");
  const existingSignals = await prisma.signal.findMany({
    where: { tenantId: tenant.id },
    select: { messageId: true, receivedAt: true },
  });

  // Crear Set para lookup rápido
  const existingKeys = new Set(
    existingSignals.map((s) => `${s.messageId}-${s.receivedAt.toISOString()}`)
  );
  console.log(`   Señales existentes en DB: ${existingSignals.length}\n`);

  // Preparar inserts
  const stats: ImportStats = {
    total: signals.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  const toInsert: PrismaSignalCreate[] = [];

  for (const signal of signals) {
    // Crear clave única para deduplicación
    const receivedAt = new Date(signal.ts_utc);
    const key = `${signal.message_id}-${receivedAt.toISOString()}`;

    // Skip si ya existe
    if (existingKeys.has(key)) {
      stats.skipped++;
      continue;
    }

    // Validar datos mínimos
    if (!signal.ts_utc || !signal.kind) {
      stats.errors++;
      continue;
    }

    toInsert.push({
      tenantId: tenant.id,
      side: signal.side || "UNKNOWN",
      price: signal.price_hint,
      symbol: "XAUUSD",
      messageText: buildMessageText(signal),
      receivedAt,
      messageId: signal.message_id,
      isCloseSignal: signal.kind === "range_close",
      status: "PENDING",
      maxLevels: 4,
    });
  }

  console.log(`📊 Resumen de preparación:`);
  console.log(`   Total en CSV: ${stats.total}`);
  console.log(`   Duplicados (skip): ${stats.skipped}`);
  console.log(`   Errores parseo: ${stats.errors}`);
  console.log(`   Listos para importar: ${toInsert.length}\n`);

  if (dryRun) {
    console.log("🔍 DRY RUN - Mostrando primeras 5 señales:");
    toInsert.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.side} @ ${s.price} | ${s.receivedAt.toISOString()} | ${s.isCloseSignal ? "CLOSE" : "OPEN"}`);
    });
    console.log("\n✅ Dry run completado. Sin cambios en DB.");
    return;
  }

  // Insertar en batches
  console.log("💾 Importando señales...\n");

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    try {
      await prisma.signal.createMany({
        data: batch,
        skipDuplicates: true,
      });

      stats.imported += batch.length;
      console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${batch.length} señales (total: ${stats.imported})`);
    } catch (error) {
      console.error(`   ❌ Error en batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      stats.errors += batch.length;
    }
  }

  // Resumen final
  console.log("\n=== Import Completed ===");
  console.log(`✅ Importadas: ${stats.imported}`);
  console.log(`⏭️  Skipped (duplicados): ${stats.skipped}`);
  console.log(`❌ Errores: ${stats.errors}`);
  console.log(`📊 Total procesadas: ${stats.total}`);
}

// Tipo para Prisma create
type PrismaSignalCreate = {
  tenantId: string;
  side: string;
  price: number | null;
  symbol: string;
  messageText: string;
  receivedAt: Date;
  messageId: string;
  isCloseSignal: boolean;
  status: string;
  maxLevels: number;
};

main()
  .catch((e) => {
    console.error("❌ Error fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
