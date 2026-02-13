import bcrypt from 'bcryptjs'
import { PrismaClient } from '../generated/prisma'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 10
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function main() {
  console.log('Starting seed...')

  const adminPassword = await hashPassword('ParkinGn2026HN')

  const admin = await prisma.user.upsert({
    where: { email: 'miladin.vidakovic@parkinghn.me' },
    update: {},
    create: {
      email: 'miladin.vidakovic@parkinghn.me',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      phone: '+382 67 123 456',
      isActive: true,
    },
  })

  const admin2 = await prisma.user.upsert({
    where: { email: 'sinisa.tomasevic@parkinghn.me' },
    update: {},
    create: {
      email: 'sinisa.tomasevic@parkinghn.me',
      password: adminPassword,
      firstName: 'Siniša',
      lastName: 'Tomašević',
      role: 'ADMINISTRATOR',
      isActive: true,
    },
  })

  console.log('\n========================================')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log('\nCreated admin users:')
  console.log('1)', admin.email)
  console.log('2)', admin2.email)
  console.log('\nYou can now log in with these credentials.')
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
