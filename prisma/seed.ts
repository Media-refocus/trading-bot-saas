import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding plans...");

  // Planes según contrato Xisco + propuesta premium
  const plans = [
    {
      name: "Starter",
      price: 57,
      currency: "EUR",
      implementationFee: 97, // Se paga aparte
      maxPositions: 1,
      maxBrokers: 1,
      maxLevels: 2,
      maxBacktestsMonth: 5,
      hasTrailingSL: false,
      hasAdvancedGrid: false,
      hasOptimizador: false,
      hasBacktestsIlimitados: false,
      hasPaperTrading: true,
      hasMetricsDashboard: false,
      hasMultiCuenta: false,
      hasApiAccess: false,
      hasVpsDedicado: false,
      hasPriority: false,
      hasSoporte247: false,
    },
    {
      name: "Trader",
      price: 97,
      currency: "EUR",
      implementationFee: null, // Incluido en el plan
      maxPositions: 3,
      maxBrokers: 2,
      maxLevels: 4,
      maxBacktestsMonth: 20,
      hasTrailingSL: true,
      hasAdvancedGrid: true,
      hasOptimizador: false,
      hasBacktestsIlimitados: false,
      hasPaperTrading: true,
      hasMetricsDashboard: false,
      hasMultiCuenta: false,
      hasApiAccess: false,
      hasVpsDedicado: false,
      hasPriority: false,
      hasSoporte247: false,
    },
    {
      name: "Pro",
      price: 197,
      currency: "EUR",
      implementationFee: null, // Incluido
      maxPositions: 5,
      maxBrokers: 5,
      maxLevels: 6,
      maxBacktestsMonth: 0, // 0 = ilimitado
      hasTrailingSL: true,
      hasAdvancedGrid: true,
      hasOptimizador: true,
      hasBacktestsIlimitados: true,
      hasPaperTrading: true,
      hasMetricsDashboard: true,
      hasMultiCuenta: false,
      hasApiAccess: false,
      hasVpsDedicado: false,
      hasPriority: true,
      hasSoporte247: false,
    },
    {
      name: "Enterprise",
      price: 497,
      currency: "EUR",
      implementationFee: null, // Incluido
      maxPositions: 10,
      maxBrokers: 999,
      maxLevels: 10,
      maxBacktestsMonth: 0, // Ilimitado
      hasTrailingSL: true,
      hasAdvancedGrid: true,
      hasOptimizador: true,
      hasBacktestsIlimitados: true,
      hasPaperTrading: true,
      hasMetricsDashboard: true,
      hasMultiCuenta: true,
      hasApiAccess: true,
      hasVpsDedicado: true,
      hasPriority: true,
      hasSoporte247: true,
    },
  ];

  // Limpiar planes antiguos y crear nuevos
  const existingPlans = await prisma.plan.findMany();

  for (const planData of plans) {
    // Buscar plan existente por nombre
    const existing = await prisma.plan.findFirst({
      where: { name: planData.name },
    });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: planData,
      });
      console.log(`✅ Plan ${planData.name} actualizado (${planData.price}€)`);
    } else {
      await prisma.plan.create({
        data: planData,
      });
      console.log(`✅ Plan ${planData.name} creado (${planData.price}€)`);
    }
  }

  // Eliminar planes antiguos que ya no existen (Basic, Pro anterior)
  const planNames = plans.map(p => p.name);
  for (const old of existingPlans) {
    if (!planNames.includes(old.name)) {
      await prisma.plan.delete({ where: { id: old.id } });
      console.log(`🗑️ Plan antiguo ${old.name} eliminado`);
    }
  }

  console.log("🎉 Seed completado!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
