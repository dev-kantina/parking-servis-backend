import bcrypt from 'bcryptjs'
import { PrismaClient } from '../generated/prisma'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 10
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function main() {
  console.log('Starting seed...')

  const adminPassword = await hashPassword('admin123')
  const managerPassword = await hashPassword('manager123')
  const workerPassword = await hashPassword('worker123')

  const admin = await prisma.user.upsert({
    where: { email: 'admin@parkingservis.me' },
    update: {},
    create: {
      email: 'admin@parkingservis.me',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      phone: '+382 67 123 456',
      isActive: true,
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@parkingservis.me' },
    update: {},
    create: {
      email: 'manager@parkingservis.me',
      password: managerPassword,
      firstName: 'Marko',
      lastName: 'Petrovic',
      role: 'MANAGER',
      phone: '+382 67 234 567',
      isActive: true,
    },
  })

  const worker1 = await prisma.user.upsert({
    where: { email: 'worker1@parkingservis.me' },
    update: {},
    create: {
      email: 'worker1@parkingservis.me',
      password: workerPassword,
      firstName: 'Nikola',
      lastName: 'Jovanovic',
      role: 'WORKER',
      phone: '+382 67 345 678',
      isActive: true,
    },
  })

  const worker2 = await prisma.user.upsert({
    where: { email: 'worker2@parkingservis.me' },
    update: {},
    create: {
      email: 'worker2@parkingservis.me',
      password: workerPassword,
      firstName: 'Dejan',
      lastName: 'Nikolic',
      role: 'WORKER',
      phone: '+382 67 456 789',
      isActive: true,
    },
  })

  console.log('Seed completed successfully!')
  console.log('\nCreated users:')
  console.log('Admin:', admin.email, '- Password: admin123')
  console.log('Manager:', manager.email, '- Password: manager123')
  console.log('Worker 1:', worker1.email, '- Password: worker123')
  console.log('Worker 2:', worker2.email, '- Password: worker123')
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
