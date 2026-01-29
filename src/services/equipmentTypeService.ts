import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { CreateEquipmentTypeDto, UpdateEquipmentTypeDto } from '../types';

export class EquipmentTypeService {
  async getAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    const equipmentTypes = await prisma.equipmentType.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    });

    return equipmentTypes;
  }

  async getById(id: string) {
    const equipmentType = await prisma.equipmentType.findUnique({
      where: { id },
      include: {
        equipment: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!equipmentType) {
      throw ApiError.notFound('Tip opreme nije pronađen');
    }

    return equipmentType;
  }

  async create(data: CreateEquipmentTypeDto) {
    // Check if type with same name already exists
    const existingType = await prisma.equipmentType.findUnique({
      where: { name: data.name },
    });

    if (existingType) {
      throw ApiError.badRequest('Tip opreme sa ovim nazivom već postoji');
    }

    const equipmentType = await prisma.equipmentType.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    return equipmentType;
  }

  async update(id: string, data: UpdateEquipmentTypeDto) {
    const existingType = await prisma.equipmentType.findUnique({
      where: { id },
    });

    if (!existingType) {
      throw ApiError.notFound('Tip opreme nije pronađen');
    }

    // If updating name, check for duplicates
    if (data.name && data.name !== existingType.name) {
      const duplicateType = await prisma.equipmentType.findUnique({
        where: { name: data.name },
      });

      if (duplicateType) {
        throw ApiError.badRequest('Tip opreme sa ovim nazivom već postoji');
      }
    }

    const equipmentType = await prisma.equipmentType.update({
      where: { id },
      data,
    });

    return equipmentType;
  }

  async updateStatus(id: string, isActive: boolean) {
    const equipmentType = await prisma.equipmentType.findUnique({
      where: { id },
    });

    if (!equipmentType) {
      throw ApiError.notFound('Tip opreme nije pronađen');
    }

    const updatedType = await prisma.equipmentType.update({
      where: { id },
      data: { isActive },
    });

    return updatedType;
  }

  async delete(id: string) {
    const equipmentType = await prisma.equipmentType.findUnique({
      where: { id },
      include: {
        equipment: true,
      },
    });

    if (!equipmentType) {
      throw ApiError.notFound('Tip opreme nije pronađen');
    }

    // Soft delete - deactivate instead of hard delete
    await prisma.equipmentType.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Tip opreme uspješno deaktiviran' };
  }
}

export default new EquipmentTypeService();
