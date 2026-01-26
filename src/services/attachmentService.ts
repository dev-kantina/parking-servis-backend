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

    // Upload to R2 (Cloudflare Object Storage)
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

    // Extract filename from URL (stored filename in R2)
    // The publicUrl format is: https://pub-xxxxx.r2.dev/<fileName>
    // So we extract the filename from the URL
    const urlParts = attachment.fileUrl.split('/');
    const storedFileName = urlParts[urlParts.length - 1];

    if (storedFileName) {
      await storageService.deleteFile(storedFileName);
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
