import { s3Client, bucketName, publicUrl } from '../config/storage';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  async uploadFile(file: Express.Multer.File): Promise<{ publicUrl: string; fileName: string }> {
    if (!file) {
      throw new Error('No file provided');
    }

    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;

    try {
      // Upload file to R2
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      });

      await s3Client.send(command);

      // Construct public URL
      // If R2_PUBLIC_URL is set, use it; otherwise construct from bucket name
      let filePublicUrl: string;
      if (publicUrl) {
        // If public URL is provided (e.g., https://pub-xxxxx.r2.dev)
        filePublicUrl = `${publicUrl}/${fileName}`;
      } else {
        // Fallback: construct URL (this may not work if public access isn't configured)
        // You should set R2_PUBLIC_URL in your .env after enabling public access
        filePublicUrl = `https://${bucketName}.r2.dev/${fileName}`;
      }

      return { publicUrl: filePublicUrl, fileName };
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });

      await s3Client.send(command);
    } catch (error) {
      console.warn(`Failed to delete file ${fileName} from R2:`, error);
      // Suppress error if file doesn't exist to avoid breaking the DB delete flow
    }
  }
}

export default new StorageService();
