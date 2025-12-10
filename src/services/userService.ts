import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { Role } from '../../generated/prisma';
import { hashPassword } from '../utils/passwordHash';

export interface UserFilters {
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: Role;
  phone?: string;
  password?: string; // Opciono - za reset lozinke
}

export class UserService {
  async getAll(filters: UserFilters = {}) {
    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
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
      orderBy: [
        { role: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return users;
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
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    return user;
  }

  async create(data: CreateUserDto) {
    // Provjeri da li korisnik sa ovim emailom već postoji
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw ApiError.badRequest('Korisnik sa ovom email adresom već postoji');
    }

    const hashedPassword = await hashPassword(data.password);

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
    });

    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    const updateData: any = {};

    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.role) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;

    // Ako je proslijeđena nova lozinka, hashiraj je
    if (data.password) {
      updateData.password = await hashPassword(data.password);
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
    });

    return user;
  }

  async delete(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
    }

    // Soft delete - samo deaktiviraj korisnika
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Korisnik uspješno deaktiviran' };
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
    });

    return workers;
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
    });

    return workers.map((w) => ({
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      email: w.email,
      assignedOrdersCount: w._count.assignedWorkOrders,
    }));
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw ApiError.notFound('Korisnik nije pronađen');
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
    });

    return updatedUser;
  }
}

export default new UserService();

