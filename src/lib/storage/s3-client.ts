/**
 * AWS S3 Client Configuration
 *
 * Provides a singleton S3 client instance and configuration constants.
 * Uses environment variables for AWS credentials and S3 bucket configuration.
 */

import { S3Client } from '@aws-sdk/client-s3';

// Singleton S3 client instance
let s3Client: S3Client | null = null;

/**
 * Get or create the S3 client instance (singleton pattern)
 * @returns Configured S3Client instance
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    // Validate required environment variables
    if (!process.env.AWS_REGION) {
      console.warn('AWS_REGION not set, using default: us-east-1');
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error(
        'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
      );
    }

    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

/**
 * S3 bucket name from environment variable
 */
export const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'invoice-scanner-files';

/**
 * Presigned URL expiration time in seconds (default 1 hour)
 */
export const PRESIGNED_URL_EXPIRY = parseInt(
  process.env.S3_PRESIGNED_URL_EXPIRY || '3600',
  10
);

/**
 * Default storage provider for new uploads ('local' or 's3')
 */
export const DEFAULT_STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 's3') as 'local' | 's3';
