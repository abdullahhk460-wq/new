import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with default accounts...');

  const adminEmail = 'admin@theden.com';
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('AdminPassword123!', 12);
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'super_admin',
      },
    });
    console.log(`Default Super Admin created: ${adminEmail} (password: AdminPassword123!)`);
  } else {
    console.log(`Super Admin already exists.`);
  }

  const altEmail = 'admin@thedenfitness.com';
  const existingAlt = await prisma.adminUser.findUnique({ where: { email: altEmail } });
  if (!existingAlt) {
    const passwordHash = await bcrypt.hash('AdminPassword123!', 12);
    await prisma.adminUser.create({
      data: {
        email: altEmail,
        passwordHash,
        role: 'super_admin',
      },
    });
    console.log(`Alternate Super Admin created: ${altEmail} (password: AdminPassword123!)`);
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
