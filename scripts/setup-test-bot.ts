/**
 * Setup de prueba para el bot
 *
 * Crea un tenant de prueba y un BotConfig con API key
 * para poder probar la conexión bot-SaaS
 *
 * Uso: npx tsx scripts/setup-test-bot.ts
 */

import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../lib/api-key";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Setup de prueba para el bot\n");

  // Limpiar datos de prueba anteriores
  const existingTenant = await prisma.tenant.findFirst({
    where: { email: "test-bot@example.com" },
  });

  if (existingTenant) {
    console.log("🧹 Limpiando datos de prueba anteriores...");
    await prisma.botHeartbeat.deleteMany({
      where: { botConfig: { tenantId: existingTenant.id } },
    });
    await prisma.trade.deleteMany({
      where: { botAccount: { botConfig: { tenantId: existingTenant.id } } },
    });
    await prisma.signal.deleteMany({
      where: { botConfig: { tenantId: existingTenant.id } },
    });
    await prisma.botPosition.deleteMany({
      where: { botAccount: { botConfig: { tenantId: existingTenant.id } } },
    });
    await prisma.botAccount.deleteMany({
      where: { botConfig: { tenantId: existingTenant.id } },
    });
    await prisma.botConfig.deleteMany({
      where: { tenantId: existingTenant.id },
    });
    await prisma.tenant.delete({
      where: { id: existingTenant.id },
    });
  }

  // Crear tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "Test Tenant",
      email: "test-bot@example.com",
    },
  });
  console.log(`✅ Tenant creado: ${tenant.id}`);

  // Generar API key usando la librería correcta (bcrypt)
  const { apiKey, apiKeyHash } = await generateApiKey();

  // Crear BotConfig
  const botConfig = await prisma.botConfig.create({
    data: {
      tenantId: tenant.id,
      apiKeyHash,
      symbol: "XAUUSD",
      magicNumber: 20250101,
      entryLot: 0.1,
      entryNumOrders: 1,
      gridStepPips: 10,
      gridLot: 0.1,
      gridMaxLevels: 4,
      gridNumOrders: 1,
      gridTolerancePips: 1,
      maxLevels: 4,
    },
  });
  console.log(`✅ BotConfig creado: ${botConfig.id}`);

  // Crear BotAccount
  const botAccount = await prisma.botAccount.create({
    data: {
      botConfigId: botConfig.id,
      loginEnc: "PLAINTEXT:12345678",
      passwordEnc: "PLAINTEXT:test_password",
      serverEnc: "PLAINTEXT:ICMarkets-Demo",
      symbol: "XAUUSD",
      magic: 20250101,
    },
  });
  console.log(`✅ BotAccount creada: ${botAccount.id}`);

  console.log("\n" + "=".repeat(60));
  console.log("🔑 API KEY PARA EL BOT:");
  console.log("=".repeat(60));
  console.log(apiKey);
  console.log("=".repeat(60));
  console.log("\n📝 Comando para probar:");
  console.log(`cd bot && python test_saas_connection.py --api-key ${apiKey}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
