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

  const admin = await prisma.user.upsert({
    where: { email: 'admin@parkingservis.hn' },
    update: {},
    create: {
      email: 'admin@parkingservis.hn',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMINISTRATOR',
      phone: '+382 67 123 456',
      isActive: true,
    },
  })

  console.log('\n========================================')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log('\nCreated admin user:')
  console.log('Email:', admin.email)
  console.log('Password: admin123')
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
