import { S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2 configuration
// R2 is S3-compatible, so we use AWS SDK
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn('⚠️  R2 credentials not fully configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your .env file');
}

// Create S3 client configured for Cloudflare R2
export const s3Client = new S3Client({
  region: 'auto', // R2 uses 'auto' as the region
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

export const bucketName = process.env.R2_BUCKET_NAME || 'woms-uploads';
export const publicUrl = process.env.R2_PUBLIC_URL || ''; // Public URL for accessing files
