import { Storage } from '@google-cloud/storage';
import path from 'path';


// If credentials are provided via JSON file path
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS 
  ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS) 
  : undefined;

// If credentials are mostly handled by automatic env variable detection or keyFilename
export const storage = new Storage({
  keyFilename,
  projectId: process.env.GCS_PROJECT_ID,
});

export const bucketName = process.env.GCS_BUCKET_NAME || 'woms-uploads';
