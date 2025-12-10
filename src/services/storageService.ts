import { storage, bucketName } from '../config/storage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  private bucket = storage.bucket(bucketName);

  async uploadFile(file: Express.Multer.File): Promise<{ publicUrl: string; fileName: string }> {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No file provided'));
      }

      const extension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${extension}`;
      const blob = this.bucket.file(fileName);

      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
      });

      blobStream.on('error', (err) => {
        reject(err);
      });

      blobStream.on('finish', async () => {
        // Make the file public (or use signed URL logic if private)
        // For simplicity, we assume public access is allowed or we are generating a public URL
        // If the bucket is not public, you might need to use `await blob.makePublic()` 
        // OR generate a signed URL for viewing.
        // Assuming public bucket for this implementation step as per common web app pattern.
        
        // Note: For a truly private bucket, use `await blob.getSignedUrl(...)`

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        resolve({ publicUrl, fileName });
      });

      blobStream.end(file.buffer);
    });
  }

  async deleteFile(fileName: string): Promise<void> {
    const file = this.bucket.file(fileName);
    try {
      await file.delete();
    } catch (error) {
      console.warn(`Failed to delete file ${fileName} from GCS:`, error);
      // Suppress error if file doesn't exist to avoid breaking the DB delete flow
    }
  }
}

export default new StorageService();
