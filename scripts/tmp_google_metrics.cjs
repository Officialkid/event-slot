const { PrismaClient } = require("../node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [users, events, registrations, activeEvents, organizersWithEvents] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.registration.count(),
    prisma.event.count({ where: { archived: false, status: "active" } }),
    prisma.user.count({ where: { events: { some: {} } } }),
  ]);

  const topEvents = await prisma.event.findMany({
    take: 5,
    orderBy: [{ confirmedCount: "desc" }, { createdAt: "desc" }],
    select: { title: true, confirmedCount: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        asOf: new Date().toISOString(),
        users,
        events,
        registrations,
        activeEvents,
        organizersWithEvents,
        topEvents,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
