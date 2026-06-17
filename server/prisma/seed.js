require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Attendance database...\n');

  // 1. System Settings
  const existingSettings = await prisma.systemSettings.findFirst();
  if (!existingSettings) {
    await prisma.systemSettings.create({
      data: {
        categories: JSON.stringify(["Skilled Worker", "Fully Skilled", "Semi Skilled", "Worker"]),
        notificationTime: "08:30",
      },
    });
    console.log('✅ System Settings created');
  } else {
    console.log('⏭️  System Settings already exist, skipping');
  }

  // 2. Manager account
  const managerPin = process.env.MANAGER_DEFAULT_PIN || '123456';
  const managerHash = await bcrypt.hash(managerPin, 12);
  await prisma.manager.upsert({
    where: { username: 'manager' },
    update: {},
    create: { username: 'manager', pinHash: managerHash },
  });
  console.log(`✅ Manager created (username: manager, PIN: ${managerPin})`);

  // 3. Workers — only seed if no workers exist yet
  const existingWorkerCount = await prisma.worker.count();
  if (existingWorkerCount > 0) {
    console.log(`⏭️  ${existingWorkerCount} workers already exist, skipping worker seed`);
  } else {
    const defaultPin = '123456';
    const workerHash = await bcrypt.hash(defaultPin, 12);
    for (let i = 1; i <= 50; i++) {
      const wid = `WRK-${String(i).padStart(3, '0')}`;
      await prisma.worker.create({
        data: { workerId: wid, name: `Worker ${i}`, pinHash: workerHash, requiresPinReset: true },
      });
    }
    console.log(`✅ 50 Workers created (PIN: ${defaultPin}, must reset on first login)`);
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

