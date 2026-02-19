/**
 * Script para generar el índice de ticks una vez y guardarlo
 * Ejecutar con: npx ts-node lib/generate-ticks-index.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const INDEX_FILE = path.join(process.cwd(), "data", "ticks-index.json");

interface DayIndex {
  date: string;
  file: string;
  startLine: number;
  endLine: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

function parseTickLine(line: string): { timestamp: Date } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("timestamp")) {
    return null;
  }

  const parts = trimmed.split(",");
  if (parts.length < 4) {
    return null;
  }

  try {
    const timestamp = new Date(parts[0]);
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp };
  } catch {
    return null;
  }
}

async function buildDayIndexForFile(filePath: string, filename: string): Promise<DayIndex[]> {
  return new Promise((resolve, reject) => {
    const indices: DayIndex[] = [];
    let buffer = "";
    let lineNum = 0;
    let currentDay: DayIndex | null = null;

    console.log(`[Index] Procesando ${filename}...`);

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    fileStream
      .pipe(gunzip)
      .on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const tick = parseTickLine(line);
          if (tick) {
            const dateKey = tick.timestamp.toISOString().slice(0, 10);

            if (!currentDay || currentDay.date !== dateKey) {
              if (currentDay) {
                currentDay.endLine = lineNum - 1;
                indices.push(currentDay);
              }
              currentDay = {
                date: dateKey,
                file: filename,
                startLine: lineNum,
                endLine: lineNum,
                firstTimestamp: tick.timestamp.toISOString(),
                lastTimestamp: tick.timestamp.toISOString(),
              };
            } else {
              currentDay.lastTimestamp = tick.timestamp.toISOString();
            }
          }
          lineNum++;
        }
      })
      .on("end", () => {
        if (currentDay) {
          currentDay.endLine = lineNum - 1;
          indices.push(currentDay);
        }
        console.log(`[Index] ${filename}: ${indices.length} días`);
        resolve(indices);
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("=== GENERANDO ÍNDICE DE TICKS ===");
  console.log(`Directorio: ${TICKS_DIR}`);
  console.log(`Archivo de salida: ${INDEX_FILE}`);

  const startTime = Date.now();

  // Verificar directorio
  if (!fs.existsSync(TICKS_DIR)) {
    console.error("ERROR: Directorio de ticks no encontrado");
    process.exit(1);
  }

  // Listar archivos
  const files = fs.readdirSync(TICKS_DIR)
    .filter(f => f.endsWith(".csv.gz"))
    .sort();

  console.log(`Archivos encontrados: ${files.length}`);

  if (files.length === 0) {
    console.error("ERROR: No hay archivos .csv.gz");
    process.exit(1);
  }

  // Construir índice
  const allIndices: DayIndex[] = [];

  for (const file of files) {
    const filePath = path.join(TICKS_DIR, file);
    const dayIndices = await buildDayIndexForFile(filePath, file);
    allIndices.push(...dayIndices);
  }

  // Guardar índice
  const indexData = {
    generated: new Date().toISOString(),
    totalDays: allIndices.length,
    days: allIndices,
  };

  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`\n=== COMPLETADO ===`);
  console.log(`Total días: ${allIndices.length}`);
  console.log(`Tiempo: ${elapsed}ms`);
  console.log(`Archivo: ${INDEX_FILE}`);
}

main().catch(console.error);
