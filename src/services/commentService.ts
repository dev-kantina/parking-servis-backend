import prisma from '../config/database';
import { ApiError } from '../utils/ApiError';
import { Role } from '../../generated/prisma';
import notificationService from './notificationService';

export interface CreateCommentDto {
  workOrderId: string;
  userId: string;
  content: string;
  isInternal?: boolean;
}

export interface UpdateCommentDto {
  content: string;
}

export class CommentService {
  async getByWorkOrderId(workOrderId: string) {
    const comments = await prisma.comment.findMany({
      where: { workOrderId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return comments;
  }

  async create(data: CreateCommentDto) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: data.workOrderId },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    const comment = await prisma.comment.create({
      data: {
        workOrderId: data.workOrderId,
        userId: data.userId,
        content: data.content,
        isInternal: data.isInternal ?? true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Notify participants
    const participants = new Set<string>();
    if (workOrder.assignedToId) participants.add(workOrder.assignedToId);
    if (workOrder.createdById) participants.add(workOrder.createdById);
    
    participants.delete(data.userId); // Don't notify self

    for (const participantId of participants) {
      await notificationService.create({
        userId: participantId,
        type: 'NEW_COMMENT',
        title: 'Novi komentar',
        message: `Novi komentar na nalogu "${workOrder.title}"`,
        workOrderId: workOrder.id,
        sentById: data.userId,
      });
    }

    return comment;
  }

  async update(id: string, userId: string, userRole: Role, data: UpdateCommentDto) {
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw ApiError.notFound('Komentar nije pronađen');
    }

    // Samo autor može da menja komentar, osim ako nije admin (opciono, za sada samo autor)
    if (comment.userId !== userId) {
      throw ApiError.forbidden('Nemate pravo da mijenjate ovaj komentar');
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return updatedComment;
  }

  async delete(id: string, userId: string, userRole: Role) {
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw ApiError.notFound('Komentar nije pronađen');
    }

    // Autor ili Admin mogu da brišu
    if (comment.userId !== userId && userRole !== Role.ADMINISTRATOR) {
      throw ApiError.forbidden('Nemate pravo da obrišete ovaj komentar');
    }

    await prisma.comment.delete({
      where: { id },
    });

    return { message: 'Komentar uspješno obrisan' };
  }
}

export default new CommentService();
