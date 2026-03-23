import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Create admin user
  const passwordHash = await bcrypt.hash('Admin2026$', 12);

  await prisma.user.upsert({
    where: { email: 'admin@qri.app' },
    update: {},
    create: {
      email: 'admin@qri.app',
      password_hash: passwordHash,
      name: 'Administrador',
      role: 'ADMIN',
      is_active: true,
    },
  });

  // System config defaults
  const defaults: Array<{ key: string; value: unknown }> = [
    { key: 'coelsa_connection', value: { status: 'disconnected', last_check: null } },
    { key: 'alerts', value: { error_rate_threshold: 0.1, consecutive_failures: 5, timeout_threshold: 3 } },
  ];

  for (const config of defaults) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: { key: config.key, value: config.value as any },
    });
  }

  // Commission profiles
  const standardProfile = await prisma.commissionProfile.upsert({
    where: { name: 'Plan Estandar' },
    update: {},
    create: {
      name: 'Plan Estandar',
      description: 'Perfil de comisiones por defecto para nuevos comercios',
      is_default: true,
      default_rate: 1.5,
      rates: [
        { mcc: '5411', rate: 0.6, direction: 'BOTH' },   // Supermercados
        { mcc: '5812', rate: 0.8, direction: 'BOTH' },   // Restaurantes
        { mcc: '5999', rate: 1.0, direction: 'BOTH' },   // Comercio minorista
        { mcc: '4814', rate: 0.5, direction: 'BOTH' },   // Telecomunicaciones
        { mcc: '5311', rate: 0.7, direction: 'BOTH' },   // Tiendas departamentales
      ],
    },
  });

  await prisma.commissionProfile.upsert({
    where: { name: 'Plan Premium' },
    update: {},
    create: {
      name: 'Plan Premium',
      description: 'Tasas reducidas para comercios de alto volumen',
      is_default: false,
      default_rate: 0.8,
      rates: [
        { mcc: '5411', rate: 0.3, direction: 'BOTH' },
        { mcc: '5812', rate: 0.4, direction: 'BOTH' },
        { mcc: '5999', rate: 0.5, direction: 'BOTH' },
      ],
    },
  });

  // Assign default profile to existing merchants without one
  await prisma.merchant.updateMany({
    where: { commission_profile_id: null },
    data: { commission_profile_id: standardProfile.id },
  });

  console.log('Seed completed: admin user (admin@qri.app / Admin2026$), commission profiles created');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
