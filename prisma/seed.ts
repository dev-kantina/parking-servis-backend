import bcrypt from 'bcryptjs'
import { PrismaClient, DayOfWeek } from '../generated/prisma'

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

  // Create shifts
  console.log('\nCreating shifts...')

  const morningShift = await prisma.shift.upsert({
    where: { name: 'Jutarnja smjena' },
    update: {},
    create: {
      name: 'Jutarnja smjena',
      startTime: '06:00',
      endTime: '14:00',
      isActive: true,
    },
  })

  const afternoonShift = await prisma.shift.upsert({
    where: { name: 'Popodnevna smjena' },
    update: {},
    create: {
      name: 'Popodnevna smjena',
      startTime: '14:00',
      endTime: '22:00',
      isActive: true,
    },
  })

  const nightShift = await prisma.shift.upsert({
    where: { name: 'Noćna smjena' },
    update: {},
    create: {
      name: 'Noćna smjena',
      startTime: '22:00',
      endTime: '06:00',
      isActive: true,
    },
  })

  console.log('Shifts created:', morningShift.name, afternoonShift.name, nightShift.name)

  // Create employee schedules
  console.log('\nCreating employee schedules...')

  // Worker 1 (Nikola) - works morning shift Mon-Fri
  const worker1Schedule = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ]

  for (const day of worker1Schedule) {
    await prisma.employeeSchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: worker1.id,
          dayOfWeek: day,
        },
      },
      update: { shiftId: morningShift.id },
      create: {
        userId: worker1.id,
        dayOfWeek: day,
        shiftId: morningShift.id,
      },
    })
  }

  // Worker 2 (Dejan) - works afternoon shift Mon-Fri, and morning on Saturday
  const worker2WeekdaySchedule = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ]

  for (const day of worker2WeekdaySchedule) {
    await prisma.employeeSchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: worker2.id,
          dayOfWeek: day,
        },
      },
      update: { shiftId: afternoonShift.id },
      create: {
        userId: worker2.id,
        dayOfWeek: day,
        shiftId: afternoonShift.id,
      },
    })
  }

  // Worker 2 also works Saturday morning
  await prisma.employeeSchedule.upsert({
    where: {
      userId_dayOfWeek: {
        userId: worker2.id,
        dayOfWeek: DayOfWeek.SATURDAY,
      },
    },
    update: { shiftId: morningShift.id },
    create: {
      userId: worker2.id,
      dayOfWeek: DayOfWeek.SATURDAY,
      shiftId: morningShift.id,
    },
  })

  console.log('Weekly schedule templates created!')
  console.log('- Nikola (Worker 1): Morning shift Mon-Fri')
  console.log('- Dejan (Worker 2): Afternoon shift Mon-Fri, Morning on Saturday')

  // Create historical schedule entries for the past 2 weeks, current week, and next week
  console.log('\nCreating historical schedule entries...')

  const daysMap: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  }

  // Get current week's Monday
  const today = new Date()
  const currentDayOfWeek = today.getDay()
  const diff = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek
  const currentWeekMonday = new Date(today)
  currentWeekMonday.setDate(today.getDate() + diff)
  currentWeekMonday.setHours(0, 0, 0, 0)

  // Start 2 weeks ago
  const startDate = new Date(currentWeekMonday)
  startDate.setDate(startDate.getDate() - 14)

  // End 1 week from now (Sunday)
  const endDate = new Date(currentWeekMonday)
  endDate.setDate(endDate.getDate() + 13)

  // Worker schedules based on templates
  const workerTemplates = [
    {
      userId: worker1.id,
      name: 'Nikola',
      schedule: {
        [DayOfWeek.MONDAY]: morningShift.id,
        [DayOfWeek.TUESDAY]: morningShift.id,
        [DayOfWeek.WEDNESDAY]: morningShift.id,
        [DayOfWeek.THURSDAY]: morningShift.id,
        [DayOfWeek.FRIDAY]: morningShift.id,
      } as Record<DayOfWeek, string>,
    },
    {
      userId: worker2.id,
      name: 'Dejan',
      schedule: {
        [DayOfWeek.MONDAY]: afternoonShift.id,
        [DayOfWeek.TUESDAY]: afternoonShift.id,
        [DayOfWeek.WEDNESDAY]: afternoonShift.id,
        [DayOfWeek.THURSDAY]: afternoonShift.id,
        [DayOfWeek.FRIDAY]: afternoonShift.id,
        [DayOfWeek.SATURDAY]: morningShift.id,
      } as Record<DayOfWeek, string>,
    },
  ]

  let entriesCreated = 0
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dayOfWeek = daysMap[currentDate.getDay()]

    for (const worker of workerTemplates) {
      const shiftId = worker.schedule[dayOfWeek]
      if (shiftId) {
        await prisma.scheduleEntry.upsert({
          where: {
            userId_date: {
              userId: worker.userId,
              date: new Date(currentDate),
            },
          },
          update: { shiftId },
          create: {
            userId: worker.userId,
            date: new Date(currentDate),
            shiftId,
          },
        })
        entriesCreated++
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`Created ${entriesCreated} schedule entries from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

  // Create work orders
  console.log('\nCreating work orders...')

  // Helper to create dates relative to today
  const daysAgo = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    date.setHours(9, 0, 0, 0)
    return date
  }

  const daysFromNow = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(17, 0, 0, 0)
    return date
  }

  const hoursAgo = (hours: number) => {
    const date = new Date()
    date.setHours(date.getHours() - hours)
    return date
  }

  // Work order data - realistic parking service scenarios
  const workOrdersData = [
    // COMPLETED orders (past)
    {
      title: 'Popravka rampe - Parking Centar',
      description: 'Rampa na ulazu u parking centar se zaglavila u otvorenom položaju. Potrebno provjeriti motor i senzore.',
      location: 'Parking Centar, Njeguševoj 12',
      latitude: 42.4247,
      longitude: 18.7712,
      priority: 'HIGH',
      status: 'COMPLETED',
      createdAt: daysAgo(21),
      deadline: daysAgo(18),
      completedAt: daysAgo(19),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Zamjena sijalica - Podzemni parking',
      description: 'Zamjena neon sijalica na nivou -2. Ukupno 8 sijalica potrebno zamijeniti.',
      location: 'Podzemni parking Trg Nikole Đurkovića',
      latitude: 42.4251,
      longitude: 18.7698,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdAt: daysAgo(18),
      deadline: daysAgo(14),
      completedAt: daysAgo(15),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    {
      title: 'Čišćenje parking prostora - Šetalište',
      description: 'Generalno čišćenje parking prostora nakon nevremena. Uklanjanje lišća i smeća.',
      location: 'Parking Šetalište Pet Danica',
      latitude: 42.4235,
      longitude: 18.7725,
      priority: 'LOW',
      status: 'COMPLETED',
      createdAt: daysAgo(15),
      deadline: daysAgo(12),
      completedAt: daysAgo(13),
      assignedToId: worker1.id,
      createdById: admin.id,
    },
    {
      title: 'Farbanje parking linija',
      description: 'Obnavljanje parking linija na otvorenom parkingu. Potrebno ofarbati 45 parking mjesta.',
      location: 'Parking Škver',
      latitude: 42.4262,
      longitude: 18.7688,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdAt: daysAgo(14),
      deadline: daysAgo(7),
      completedAt: daysAgo(9),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    {
      title: 'Popravka parking automata #3',
      description: 'Automat ne prima kovanice. Potrebno očistiti mehanizam i testirati.',
      location: 'Parking Meljine',
      latitude: 42.4389,
      longitude: 18.7012,
      priority: 'HIGH',
      status: 'COMPLETED',
      createdAt: daysAgo(12),
      deadline: daysAgo(10),
      completedAt: daysAgo(10),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Instalacija novog znaka',
      description: 'Postavljanje novog znaka "Rezervisano" na parking mjestu br. 15.',
      location: 'Parking Topla',
      latitude: 42.4298,
      longitude: 18.7645,
      priority: 'LOW',
      status: 'COMPLETED',
      createdAt: daysAgo(10),
      deadline: daysAgo(7),
      completedAt: daysAgo(8),
      assignedToId: worker2.id,
      createdById: admin.id,
    },
    {
      title: 'Popravka osvjetljenja ulaza',
      description: 'LED reflektor na ulazu ne radi. Potrebno provjeriti napajanje i zamijeniti ako je neophodno.',
      location: 'Parking Centar, Njeguševoj 12',
      latitude: 42.4247,
      longitude: 18.7712,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdAt: daysAgo(8),
      deadline: daysAgo(5),
      completedAt: daysAgo(6),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Pregled i održavanje rampi',
      description: 'Redovno mjesečno održavanje svih rampi. Podmazivanje i provjera senzora.',
      location: 'Svi parkinzi - obilazak',
      latitude: 42.4250,
      longitude: 18.7700,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdAt: daysAgo(7),
      deadline: daysAgo(3),
      completedAt: daysAgo(4),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    // Completed late (past deadline)
    {
      title: 'Popravka ventilacije',
      description: 'Ventilacioni sistem na nivou -1 ne radi ispravno. Buka i smanjen protok vazduha.',
      location: 'Podzemni parking Trg',
      latitude: 42.4251,
      longitude: 18.7698,
      priority: 'HIGH',
      status: 'COMPLETED',
      createdAt: daysAgo(14),
      deadline: daysAgo(10),
      completedAt: daysAgo(7), // Completed late
      assignedToId: worker1.id,
      createdById: admin.id,
    },
    // IN_PROGRESS orders (current)
    {
      title: 'Zamjena parking automata #5',
      description: 'Stari automat je van funkcije. Instalirati novi automat i konfigurisati tarife.',
      location: 'Parking Savina',
      latitude: 42.4312,
      longitude: 18.7556,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdAt: daysAgo(3),
      deadline: daysFromNow(2),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Postavljanje novih saobraćajnih znakova',
      description: 'Postavljanje 5 novih znakova za označavanje smjera kretanja na parkingu.',
      location: 'Parking Đenovići',
      latitude: 42.4178,
      longitude: 18.7234,
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      createdAt: daysAgo(2),
      deadline: daysFromNow(3),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    {
      title: 'Sanacija oštećenja asfalta',
      description: 'Popravka rupa i pukotina na parking površini. Potreban asfalt i mašina.',
      location: 'Parking Igalo',
      latitude: 42.4456,
      longitude: 18.6234,
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      createdAt: daysAgo(1),
      deadline: daysFromNow(5),
      assignedToId: worker1.id,
      createdById: admin.id,
    },
    // ACCEPTED orders
    {
      title: 'Čišćenje sistema za odvodnjavanje',
      description: 'Kanalizacioni otvori su začepljeni. Očistiti slivnike i provjeriti protok.',
      location: 'Parking Centar',
      latitude: 42.4247,
      longitude: 18.7712,
      priority: 'MEDIUM',
      status: 'ACCEPTED',
      createdAt: hoursAgo(6),
      deadline: daysFromNow(4),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    {
      title: 'Instalacija kamere #7',
      description: 'Montaža nove nadzorne kamere na ulazu u parking. Povezivanje sa centralnim sistemom.',
      location: 'Parking Zelenika',
      latitude: 42.4512,
      longitude: 18.5789,
      priority: 'LOW',
      status: 'ACCEPTED',
      createdAt: hoursAgo(4),
      deadline: daysFromNow(7),
      assignedToId: worker1.id,
      createdById: admin.id,
    },
    // ON_HOLD orders
    {
      title: 'Zamjena elektro-ormara',
      description: 'Glavni elektro-ormar treba zamjenu. Čekamo isporuku novog ormara.',
      location: 'Podzemni parking Trg',
      latitude: 42.4251,
      longitude: 18.7698,
      priority: 'HIGH',
      status: 'ON_HOLD',
      createdAt: daysAgo(5),
      deadline: daysFromNow(10),
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    // NEW orders (unassigned and assigned)
    {
      title: 'Inspekcija protivpožarnih aparata',
      description: 'Redovna godišnja inspekcija svih PP aparata na podzemnom parkingu.',
      location: 'Podzemni parking Trg',
      latitude: 42.4251,
      longitude: 18.7698,
      priority: 'MEDIUM',
      status: 'NEW',
      createdAt: hoursAgo(2),
      deadline: daysFromNow(14),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Popravka interfonskog sistema',
      description: 'Interfon na ulazu ne radi. Korisnici ne mogu kontaktirati dežurnog.',
      location: 'Parking Centar',
      latitude: 42.4247,
      longitude: 18.7712,
      priority: 'HIGH',
      status: 'NEW',
      createdAt: hoursAgo(1),
      deadline: daysFromNow(1),
      createdById: admin.id,
      // Not assigned yet
    },
    // URGENT order - needs attention
    {
      title: 'Hitna popravka - curenje vode',
      description: 'Pukla cijev na nivou -2. Voda curi i ugrožava elektro instalacije. HITNO!',
      location: 'Podzemni parking Trg, nivo -2',
      latitude: 42.4251,
      longitude: 18.7698,
      priority: 'URGENT',
      status: 'NEW',
      createdAt: hoursAgo(1),
      deadline: daysFromNow(0), // Today!
      assignedToId: worker1.id,
      createdById: admin.id,
    },
    // Overdue order
    {
      title: 'Zamjena pokvarenog reflektora',
      description: 'Reflektor na parkingu prestao raditi. Potrebna zamjena.',
      location: 'Parking Baošići',
      latitude: 42.4089,
      longitude: 18.6567,
      priority: 'LOW',
      status: 'ACCEPTED',
      createdAt: daysAgo(10),
      deadline: daysAgo(2), // Past deadline - overdue!
      assignedToId: worker2.id,
      createdById: manager.id,
    },
    // More completed orders for better calendar data
    {
      title: 'Postavljanje ležećih policajaca',
      description: 'Instalacija 3 ležeća policajca za usporavanje saobraćaja.',
      location: 'Parking Bijela',
      latitude: 42.4567,
      longitude: 18.6712,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdAt: daysAgo(25),
      deadline: daysAgo(20),
      completedAt: daysAgo(21),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    {
      title: 'Servis parking aparata #1',
      description: 'Redovno servisiranje i čišćenje parking aparata.',
      location: 'Parking Centar',
      latitude: 42.4247,
      longitude: 18.7712,
      priority: 'LOW',
      status: 'COMPLETED',
      createdAt: daysAgo(28),
      deadline: daysAgo(25),
      completedAt: daysAgo(26),
      assignedToId: worker2.id,
      createdById: admin.id,
    },
    {
      title: 'Popravka sistema naplate',
      description: 'Softverska greška u sistemu naplate. Potrebna intervencija.',
      location: 'Parking Meljine',
      latitude: 42.4389,
      longitude: 18.7012,
      priority: 'HIGH',
      status: 'COMPLETED',
      createdAt: daysAgo(20),
      deadline: daysAgo(18),
      completedAt: daysAgo(18),
      assignedToId: worker1.id,
      createdById: manager.id,
    },
    // Future deadline orders
    {
      title: 'Godišnji pregled sistema',
      description: 'Kompletan pregled svih parking sistema prije ljetnje sezone.',
      location: 'Svi parkinzi',
      latitude: 42.4250,
      longitude: 18.7700,
      priority: 'MEDIUM',
      status: 'NEW',
      createdAt: daysAgo(1),
      deadline: daysFromNow(30),
      createdById: manager.id,
    },
  ]

  // First, clear existing work orders and status history
  await prisma.workOrderStatusHistory.deleteMany({})
  await prisma.workOrder.deleteMany({})

  let workOrdersCreated = 0

  for (const wo of workOrdersData) {
    const workOrder = await prisma.workOrder.create({
      data: {
        title: wo.title,
        description: wo.description,
        location: wo.location,
        latitude: wo.latitude,
        longitude: wo.longitude,
        priority: wo.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        status: wo.status as 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED',
        deadline: wo.deadline,
        createdAt: wo.createdAt,
        updatedAt: wo.completedAt || wo.createdAt,
        completedAt: wo.completedAt || null,
        createdById: wo.createdById,
        assignedToId: wo.assignedToId || null,
      },
    })

    // Create status history
    const statusHistory: { oldStatus: string | null; newStatus: string; createdAt: Date }[] = [
      { oldStatus: null, newStatus: 'NEW', createdAt: wo.createdAt },
    ]

    if (wo.status === 'ACCEPTED' || wo.status === 'IN_PROGRESS' || wo.status === 'ON_HOLD' || wo.status === 'COMPLETED') {
      const acceptedAt = new Date(wo.createdAt)
      acceptedAt.setHours(acceptedAt.getHours() + 2)
      statusHistory.push({ oldStatus: 'NEW', newStatus: 'ACCEPTED', createdAt: acceptedAt })
    }

    if (wo.status === 'IN_PROGRESS' || wo.status === 'COMPLETED') {
      const inProgressAt = new Date(wo.createdAt)
      inProgressAt.setHours(inProgressAt.getHours() + 4)
      statusHistory.push({ oldStatus: 'ACCEPTED', newStatus: 'IN_PROGRESS', createdAt: inProgressAt })
    }

    if (wo.status === 'ON_HOLD') {
      const onHoldAt = new Date(wo.createdAt)
      onHoldAt.setDate(onHoldAt.getDate() + 1)
      statusHistory.push({ oldStatus: 'ACCEPTED', newStatus: 'ON_HOLD', createdAt: onHoldAt })
    }

    if (wo.status === 'COMPLETED' && wo.completedAt) {
      statusHistory.push({ oldStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', createdAt: wo.completedAt })
    }

    for (const sh of statusHistory) {
      await prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: workOrder.id,
          oldStatus: sh.oldStatus as 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | null,
          newStatus: sh.newStatus as 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED',
          createdAt: sh.createdAt,
        },
      })
    }

    workOrdersCreated++
  }

  console.log(`Created ${workOrdersCreated} work orders with status history`)

  console.log('\n========================================')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log('\nCreated users:')
  console.log('Admin:', admin.email, '- Password: admin123')
  console.log('Manager:', manager.email, '- Password: manager123')
  console.log('Worker 1:', worker1.email, '- Password: worker123')
  console.log('Worker 2:', worker2.email, '- Password: worker123')
  console.log('\nCreated shifts:')
  console.log('- Jutarnja smjena (06:00 - 14:00)')
  console.log('- Popodnevna smjena (14:00 - 22:00)')
  console.log('- Noćna smjena (22:00 - 06:00)')
  console.log('\nSchedule entries created for 4 weeks (2 past, current, 1 future)')
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
