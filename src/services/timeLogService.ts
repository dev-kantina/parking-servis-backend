import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';

export interface StartTimerDto {
  workOrderId: string;
  userId: string;
}

export interface StopTimerDto {
  userId: string;
  note?: string;
}

export interface ManualLogDto {
  workOrderId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  note?: string;
}

export class TimeLogService {
  async startTimer(workOrderId: string, userId: string) {
    // 1. Check if user already has an active timer
    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: {
        workOrder: {
          select: { title: true },
        },
      },
    });

    if (activeTimer) {
      throw ApiError.badRequest(
        `Već imate aktivan tajmer na nalogu "${activeTimer.workOrder.title}". Morate ga prvo zaustaviti.`
      );
    }

    // 2. Check if work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    // 3. Start new timer
    const timeLog = await prisma.timeLog.create({
      data: {
        workOrderId,
        userId,
        startTime: new Date(),
        isManualEntry: false,
      },
      include: {
        workOrder: { select: { title: true, id: true } },
      },
    });

    return timeLog;
  }

  async stopTimer(userId: string, note?: string) {
    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId,
        endTime: null,
      },
    });

    if (!activeTimer) {
      throw ApiError.notFound('Nemate aktivan tajmer.');
    }

    const endTime = new Date();
    const startTime = new Date(activeTimer.startTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60);

    const timeLog = await prisma.timeLog.update({
      where: { id: activeTimer.id },
      data: {
        endTime,
        duration: durationMinutes,
        note,
      },
      include: {
        workOrder: { select: { title: true, id: true } },
      },
    });

    return timeLog;
  }

  async logManual(data: ManualLogDto) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (endTime <= startTime) {
      throw ApiError.badRequest('Vrijeme završetka mora biti nakon vremena početka.');
    }

    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60);

    const timeLog = await prisma.timeLog.create({
      data: {
        workOrderId: data.workOrderId,
        userId: data.userId,
        startTime,
        endTime,
        duration: durationMinutes,
        note: data.note,
        isManualEntry: true,
      },
    });

    return timeLog;
  }

  async getActiveByUser(userId: string) {
    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: {
        workOrder: { select: { title: true, id: true, status: true } },
      },
    });

    return activeTimer;
  }

  async getByWorkOrderId(workOrderId: string) {
    const logs = await prisma.timeLog.findMany({
      where: { workOrderId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return logs;
  }
}

export default new TimeLogService();
