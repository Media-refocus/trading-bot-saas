import { prisma } from "../lib/prisma";

async function main() {
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
  });
  console.log("Planes en DB:");
  console.log(JSON.stringify(plans, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
