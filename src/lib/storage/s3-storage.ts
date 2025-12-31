/**
 * AWS S3 Storage Implementation
 *
 * Implements the StorageStrategy interface for AWS S3 cloud storage.
 * Handles file uploads, downloads, deletions, and presigned URL generation.
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageStrategy, FileMetadata } from './storage-strategy';
import { getS3Client, S3_BUCKET_NAME, PRESIGNED_URL_EXPIRY } from './s3-client';

export class S3Storage implements StorageStrategy {
  private client = getS3Client();
  private bucket = S3_BUCKET_NAME;

  /**
   * Parse S3 URL to extract bucket and key
   * Supports: s3://bucket/key or https://bucket.s3.region.amazonaws.com/key
   * @param fileUrl - S3 URL
   * @returns Object with bucket and key
   */
  private parseS3Url(fileUrl: string): { bucket: string; key: string } {
    // Handle s3:// protocol URLs
    if (fileUrl.startsWith('s3://')) {
      const url = fileUrl.replace('s3://', '');
      const [bucket, ...keyParts] = url.split('/');
      return { bucket, key: keyParts.join('/') };
    }

    // Handle HTTPS S3 URLs (e.g., https://bucket.s3.region.amazonaws.com/key)
    const match = fileUrl.match(/https:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/);
    if (match) {
      return { bucket: match[1], key: match[3] };
    }

    throw new Error(`Invalid S3 URL format: ${fileUrl}`);
  }

  /**
   * Sanitize metadata - S3 only accepts string values
   * @param metadata - File metadata
   * @returns Sanitized metadata object
   */
  private sanitizeMetadata(metadata: FileMetadata): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  /**
   * Upload file to S3
   * @param buffer - File buffer
   * @param key - S3 object key (e.g., "users/userId/invoices/filename.pdf")
   * @param metadata - Optional metadata (contentType, userId, etc.)
   * @returns S3 URL (e.g., "s3://bucket-name/users/userId/invoices/file.pdf")
   */
  async upload(buffer: Buffer, key: string, metadata?: FileMetadata): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: metadata?.contentType || 'application/pdf',
      Metadata: metadata ? this.sanitizeMetadata(metadata) : {},
      ServerSideEncryption: 'AES256', // Enable server-side encryption
    });

    try {
      await this.client.send(command);
      return `s3://${this.bucket}/${key}`;
    } catch (error: any) {
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Read file from S3
   * @param fileUrl - S3 URL
   * @returns File buffer
   * @throws Error if file not found or read fails
   */
  async read(fileUrl: string): Promise<Buffer> {
    const { bucket, key } = this.parseS3Url(fileUrl);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);

      // Convert stream to buffer
      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error: any) {
      // Check if it's a NoSuchKey error (file not found)
      if (error.name === 'NoSuchKey') {
        throw new Error(`File not found in S3: ${fileUrl}`);
      }
      throw new Error(`Failed to read file from S3: ${fileUrl} - ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param fileUrl - S3 URL
   * @throws Logs error but doesn't throw (graceful degradation)
   */
  async delete(fileUrl: string): Promise<void> {
    const { bucket, key } = this.parseS3Url(fileUrl);

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      // Log error but don't throw - file might already be deleted
      console.error(`Error deleting S3 file ${fileUrl}:`, error);
    }
  }

  /**
   * Generate presigned download URL for S3 file
   * @param fileUrl - S3 URL
   * @param expiresIn - Expiration time in seconds (default 1 hour)
   * @returns Presigned HTTPS URL for downloading the file
   */
  async getDownloadUrl(fileUrl: string, expiresIn: number = PRESIGNED_URL_EXPIRY): Promise<string> {
    const { bucket, key } = this.parseS3Url(fileUrl);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error: any) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   * @param fileUrl - S3 URL
   * @returns True if file exists, false otherwise
   */
  async exists(fileUrl: string): Promise<boolean> {
    const { bucket, key } = this.parseS3Url(fileUrl);

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata from S3
   * @param fileUrl - S3 URL
   * @returns File metadata or null if not found
   */
  async getMetadata(fileUrl: string): Promise<FileMetadata | null> {
    const { bucket, key } = this.parseS3Url(fileUrl);

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        contentType: response.ContentType,
        ...response.Metadata,
      };
    } catch {
      return null;
    }
  }
}
