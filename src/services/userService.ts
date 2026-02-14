import prisma from '../config/database'
import { ApiError } from '../utils/ApiError'
import { Role } from '../../generated/prisma'
import { hashPassword } from '../utils/passwordHash'
import { getBusinessToday, parseDate } from '../utils/timezone'

export interface UserFilters {
  role?: Role
  isActive?: boolean
  search?: string
}

export interface CreateUserDto {
  email: string
  password: string
  firstName: string
  lastName: string
  role: Role
  phone?: string
}

export interface UpdateUserDto {
  firstName?: string
  lastName?: string
  role?: Role
  phone?: string
  password?: string // Opciono - za reset lozinke
}

export class UserService {
  async getAll(filters: UserFilters = {}) {
    const where: any = {}

    if (filters.role) {
      where.role = filters.role
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    })

    return users
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen')
    }

    return user
  }

  async create(data: CreateUserDto) {
    // Provjeri da li korisnik sa ovim emailom već postoji
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw ApiError.badRequest('Korisnik sa ovom email adresom već postoji')
    }

    const hashedPassword = await hashPassword(data.password)

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phone: data.phone,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    })

    return user
  }

  async update(id: string, data: UpdateUserDto) {
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      throw ApiError.notFound('Korisnik nije pronađen')
    }

    const updateData: any = {}

    if (data.firstName) updateData.firstName = data.firstName
    if (data.lastName) updateData.lastName = data.lastName
    if (data.role) updateData.role = data.role
    if (data.phone !== undefined) updateData.phone = data.phone

    // Ako je proslijeđena nova lozinka, hashiraj je
    if (data.password) {
      updateData.password = await hashPassword(data.password)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return user
  }

  async delete(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen')
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return { message: 'Korisnik uspješno deaktiviran' }
  }

  async getWorkers() {
    const workers = await prisma.user.findMany({
      where: {
        role: Role.WORKER,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    })

    return workers
  }

  async getWorkersWithStats() {
    const workers = await prisma.user.findMany({
      where: {
        role: Role.WORKER,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        _count: {
          select: {
            assignedWorkOrders: true,
          },
        },
      },
      orderBy: {
        firstName: 'asc',
      },
    })

    return workers.map((w) => ({
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      email: w.email,
      assignedOrdersCount: w._count.assignedWorkOrders,
    }))
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen')
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    })

    return updatedUser
  }

  async getAvailableWorkers(date?: string) {
    // Use business timezone to determine "today"
    const todayStr = getBusinessToday();
    const today = parseDate(todayStr);

    // Tomorrow and next 7 days for range queries
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Parse target date if provided
    let targetDate: Date | null = null;
    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    // Get all active workers
    const workers = await prisma.user.findMany({
      where: {
        role: Role.WORKER,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // Get schedule entries for today
    const todayEntries = await prisma.scheduleEntry.findMany({
      where: {
        date: today,
        userId: { in: workers.map(w => w.id) },
        shift: { isActive: true },
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get schedule entries for the next 7 days (excluding today)
    const restOfWeekEntries = await prisma.scheduleEntry.findMany({
      where: {
        date: { gte: tomorrow, lte: next7Days },
        userId: { in: workers.map(w => w.id) },
        shift: { isActive: true },
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get target date entries if needed
    const targetDateEntries = targetDate && targetDate.getTime() !== today.getTime() 
      ? await prisma.scheduleEntry.findMany({
          where: {
            date: targetDate,
            userId: { in: workers.map(w => w.id) },
            shift: { isActive: true },
          },
          include: {
            shift: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];

    // Build a map of worker schedules
    const workerSchedules = new Map<string, {
      today?: { shiftId: string; shiftName: string };
      nextWorkDateThisWeek?: string; // ISO date string
      targetDate?: { shiftId: string; shiftName: string };
    }>();

    // Process today entries
    for (const entry of todayEntries) {
      const existing = workerSchedules.get(entry.userId) || {};
      existing.today = { shiftId: entry.shift.id, shiftName: entry.shift.name };
      workerSchedules.set(entry.userId, existing);
    }

    // Process rest of week entries - find first work date for each worker
    for (const entry of restOfWeekEntries) {
      const existing = workerSchedules.get(entry.userId) || {};
      // Only set if not already set (we want the first/earliest date)
      if (!existing.nextWorkDateThisWeek) {
        existing.nextWorkDateThisWeek = entry.date.toISOString().split('T')[0];
      }
      workerSchedules.set(entry.userId, existing);
    }

    // Process target date entries
    for (const entry of targetDateEntries) {
      const existing = workerSchedules.get(entry.userId) || {};
      existing.targetDate = { shiftId: entry.shift.id, shiftName: entry.shift.name };
      workerSchedules.set(entry.userId, existing);
    }

    // Map workers with their schedule info
    const workersWithSchedule = workers.map((worker) => {
      const schedule = workerSchedules.get(worker.id);
      return {
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email,
        worksToday: !!schedule?.today,
        nextWorkDateThisWeek: schedule?.nextWorkDateThisWeek || null,
        worksOnTargetDate: !!schedule?.targetDate,
        todayShift: schedule?.today,
        targetDateShift: schedule?.targetDate,
      };
    });

    // Sort: workers on target date first, then today, then has next work date this week, then others
    workersWithSchedule.sort((a, b) => {
      const getScore = (w: typeof a) => {
        if (targetDate && w.worksOnTargetDate) return 4;
        if (w.worksToday) return 3;
        if (w.nextWorkDateThisWeek) return 2;
        return 1;
      };
      return getScore(b) - getScore(a);
    });

    return workersWithSchedule;
  }
}

export default new UserService()
