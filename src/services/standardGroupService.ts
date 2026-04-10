import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';

export interface CreateStandardGroupDto {
  name: string;
  description?: string;
}

export interface UpdateStandardGroupDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export class StandardGroupService {
  async getAll(onlyActive?: boolean) {
    return prisma.standardGroup.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { standards: true },
        },
      },
    });
  }

  async getById(id: string) {
    const group = await prisma.standardGroup.findUnique({
      where: { id },
      include: {
        standards: {
          orderBy: { title: 'asc' },
          select: {
            id: true,
            title: true,
            isActive: true,
          },
        },
        _count: {
          select: { standards: true },
        },
      },
    });

    if (!group) {
      throw ApiError.notFound('Grupa standarda nije pronađena');
    }

    return group;
  }

  async create(data: CreateStandardGroupDto) {
    const existing = await prisma.standardGroup.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw ApiError.badRequest('Grupa sa ovim imenom već postoji');
    }

    return prisma.standardGroup.create({
      data: {
        name: data.name,
        description: data.description,
      },
      include: {
        _count: { select: { standards: true } },
      },
    });
  }

  async update(id: string, data: UpdateStandardGroupDto) {
    const existing = await prisma.standardGroup.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Grupa standarda nije pronađena');
    }

    if (data.name && data.name !== existing.name) {
      const nameTaken = await prisma.standardGroup.findUnique({
        where: { name: data.name },
      });
      if (nameTaken) {
        throw ApiError.badRequest('Grupa sa ovim imenom već postoji');
      }
    }

    return prisma.standardGroup.update({
      where: { id },
      data,
      include: {
        _count: { select: { standards: true } },
      },
    });
  }

  async delete(id: string) {
    const existing = await prisma.standardGroup.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Grupa standarda nije pronađena');
    }

    await prisma.standardGroup.delete({ where: { id } });
    return { message: 'Grupa standarda uspješno obrisana' };
  }
}

export default new StandardGroupService();
