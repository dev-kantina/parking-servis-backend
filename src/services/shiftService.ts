import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';

export interface CreateShiftDto {
  name: string;
  startTime: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
}

export interface UpdateShiftDto {
  name?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

export class ShiftService {
  async getAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    return shifts;
  }

  async getById(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!shift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    return shift;
  }

  async create(data: CreateShiftDto) {
    // Check if shift with same name already exists
    const existingShift = await prisma.shift.findUnique({
      where: { name: data.name },
    });

    if (existingShift) {
      throw ApiError.badRequest('Smjena sa ovim nazivom već postoji');
    }

    // Validate time format
    if (!this.isValidTimeFormat(data.startTime) || !this.isValidTimeFormat(data.endTime)) {
      throw ApiError.badRequest('Nevažeći format vremena. Koristite format HH:MM');
    }

    const shift = await prisma.shift.create({
      data: {
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    return shift;
  }

  async update(id: string, data: UpdateShiftDto) {
    const existingShift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existingShift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    // If updating name, check for duplicates
    if (data.name && data.name !== existingShift.name) {
      const duplicateShift = await prisma.shift.findUnique({
        where: { name: data.name },
      });

      if (duplicateShift) {
        throw ApiError.badRequest('Smjena sa ovim nazivom već postoji');
      }
    }

    // Validate time format if provided
    if (data.startTime && !this.isValidTimeFormat(data.startTime)) {
      throw ApiError.badRequest('Nevažeći format početnog vremena. Koristite format HH:MM');
    }

    if (data.endTime && !this.isValidTimeFormat(data.endTime)) {
      throw ApiError.badRequest('Nevažeći format završnog vremena. Koristite format HH:MM');
    }

    const shift = await prisma.shift.update({
      where: { id },
      data,
    });

    return shift;
  }

  async delete(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        weeklySchedules: true,
        scheduleEntries: true,
      },
    });

    if (!shift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    // Soft delete - deactivate instead of hard delete
    await prisma.shift.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Smjena uspješno deaktivirana' };
  }

  async updateStatus(id: string, isActive: boolean) {
    const shift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!shift) {
      throw ApiError.notFound('Smjena nije pronađena');
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: { isActive },
    });

    return updatedShift;
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
}

export default new ShiftService();
