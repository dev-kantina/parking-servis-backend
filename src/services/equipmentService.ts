import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { CreateEquipmentDto, UpdateEquipmentDto } from '../types';

export interface EquipmentFilters {
  typeId?: string;
  isActive?: boolean;
  search?: string;
}

export class EquipmentService {
  async getAll(filters: EquipmentFilters = {}) {
    const where: any = {};

    if (filters.typeId) {
      where.typeId = filters.typeId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const equipment = await prisma.equipment.findMany({
      where,
      orderBy: [{ type: { name: 'asc' } }, { name: 'asc' }],
      include: {
        type: true,
        _count: {
          select: { workOrders: true },
        },
      },
    });

    return equipment;
  }

  async getById(id: string) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        type: true,
        workOrders: {
          include: {
            workOrder: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!equipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    return equipment;
  }

  async create(data: CreateEquipmentDto) {
    // Verify equipment type exists
    const equipmentType = await prisma.equipmentType.findUnique({
      where: { id: data.typeId },
    });

    if (!equipmentType) {
      throw ApiError.badRequest('Tip opreme nije pronađen');
    }

    if (!equipmentType.isActive) {
      throw ApiError.badRequest('Tip opreme nije aktivan');
    }

    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        description: data.description,
        typeId: data.typeId,
        quantity: data.quantity,
      },
      include: {
        type: true,
      },
    });

    return equipment;
  }

  async update(id: string, data: UpdateEquipmentDto, userId: string) {
    const existingEquipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!existingEquipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    // If updating type, verify it exists
    if (data.typeId) {
      const equipmentType = await prisma.equipmentType.findUnique({
        where: { id: data.typeId },
      });

      if (!equipmentType) {
        throw ApiError.badRequest('Tip opreme nije pronađen');
      }

      if (!equipmentType.isActive) {
        throw ApiError.badRequest('Tip opreme nije aktivan');
      }
    }

    const quantityChanged =
      data.quantity !== undefined && data.quantity !== existingEquipment.quantity;

    const equipment = await prisma.$transaction(async (tx) => {
      const updated = await tx.equipment.update({
        where: { id },
        data,
        include: {
          type: true,
        },
      });

      if (quantityChanged) {
        await tx.equipmentQuantityLog.create({
          data: {
            equipmentId: id,
            userId,
            oldQuantity: existingEquipment.quantity,
            newQuantity: data.quantity ?? null,
          },
        });
      }

      return updated;
    });

    return equipment;
  }

  async updateQuantity(id: string, quantity: number, userId: string) {
    const existingEquipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!existingEquipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    if (existingEquipment.quantity === null) {
      throw ApiError.badRequest(
        'Ova oprema je pojedinačna i nema količinsko stanje'
      );
    }

    if (existingEquipment.quantity === quantity) {
      return prisma.equipment.findUnique({
        where: { id },
        include: { type: true },
      });
    }

    const equipment = await prisma.$transaction(async (tx) => {
      const updated = await tx.equipment.update({
        where: { id },
        data: { quantity },
        include: { type: true },
      });

      await tx.equipmentQuantityLog.create({
        data: {
          equipmentId: id,
          userId,
          oldQuantity: existingEquipment.quantity,
          newQuantity: quantity,
        },
      });

      return updated;
    });

    return equipment;
  }

  async getQuantityHistory(id: string) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!equipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    const logs = await prisma.equipmentQuantityLog.findMany({
      where: { equipmentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return logs;
  }

  async updateStatus(id: string, isActive: boolean) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    const updatedEquipment = await prisma.equipment.update({
      where: { id },
      data: { isActive },
      include: {
        type: true,
      },
    });

    return updatedEquipment;
  }

  async delete(id: string) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        workOrders: true,
      },
    });

    if (!equipment) {
      throw ApiError.notFound('Oprema nije pronađena');
    }

    // Soft delete - deactivate instead of hard delete
    await prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Oprema uspješno deaktivirana' };
  }

  // Get available equipment for work order selection
  async getAvailableForWorkOrder() {
    const equipment = await prisma.equipment.findMany({
      where: {
        isActive: true,
        type: {
          isActive: true,
        },
      },
      orderBy: [{ type: { name: 'asc' } }, { name: 'asc' }],
      include: {
        type: true,
      },
    });

    // Group by type for easier frontend rendering
    const grouped = equipment.reduce(
      (acc, item) => {
        const typeName = item.type.name;
        if (!acc[typeName]) {
          acc[typeName] = {
            typeId: item.typeId,
            typeName: typeName,
            items: [],
          };
        }
        acc[typeName].items.push(item);
        return acc;
      },
      {} as Record<string, { typeId: string; typeName: string; items: typeof equipment }>
    );

    return Object.values(grouped);
  }
}

export default new EquipmentService();
