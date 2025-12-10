import prisma from '../config/database';
import storageService from './storageService';
import { ApiError } from '../utils/ApiError';

export interface CreateAttachmentDto {
  workOrderId: string;
  file: Express.Multer.File;
}

export class AttachmentService {
  async  create(data: CreateAttachmentDto) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: data.workOrderId },
    });

    if (!workOrder) {
      throw ApiError.notFound('Radni nalog nije pronađen');
    }

    // Upload to GCS
    const { publicUrl } = await storageService.uploadFile(data.file);

    // Create DB Record
    const attachment = await prisma.attachment.create({
      data: {
        workOrderId: data.workOrderId,
        fileName: data.file.originalname,
        fileUrl: publicUrl, // Storing the full public URL
        fileType: data.file.mimetype,
        fileSize: data.file.size,
      },
    });

    return attachment;
  }

  async delete(id: string) {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw ApiError.notFound('Prilog nije pronađen');
    }

    // Extract filename from URL or store GCS filename in DB separately?
    // In our simplified storageService, we constructed publicUrl as `.../${fileName}`.
    // So we can extract it back. Ideally, we should store `gcsFileName` in DB, but for now:
    const urlParts = attachment.fileUrl.split('/');
    const gcsFileName = urlParts[urlParts.length - 1];

    if (gcsFileName) {
      await storageService.deleteFile(gcsFileName);
    }

    await prisma.attachment.delete({
      where: { id },
    });

    return { message: 'Prilog je uspješno obrisan' };
  }

  async getByWorkOrderId(workOrderId: string) {
    return await prisma.attachment.findMany({
      where: { workOrderId },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}

export default new AttachmentService();
