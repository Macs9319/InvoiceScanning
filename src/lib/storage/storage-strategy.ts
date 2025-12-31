/**
 * Storage Strategy Interface
 *
 * Defines the contract for file storage implementations (local filesystem, S3, etc.)
 * Uses Strategy Pattern to allow transparent switching between storage backends.
 */

export interface FileMetadata {
  contentType?: string;
  userId?: string;
  fileName?: string;
  [key: string]: string | undefined;
}

export interface StorageStrategy {
  /**
   * Upload a file and return the storage URL
   * @param buffer - File buffer
   * @param key - Storage key (e.g., "users/{userId}/invoices/{filename}")
   * @param metadata - Optional metadata (contentType, userId, etc.)
   * @returns Storage URL (e.g., "s3://bucket/key" or "/uploads/file.pdf")
   */
  upload(buffer: Buffer, key: string, metadata?: FileMetadata): Promise<string>;

  /**
   * Read a file and return its buffer
   * @param fileUrl - Storage URL
   * @returns File buffer
   * @throws Error if file not found or read fails
   */
  read(fileUrl: string): Promise<Buffer>;

  /**
   * Delete a file
   * @param fileUrl - Storage URL
   * @throws Error if deletion fails (or logs and continues gracefully)
   */
  delete(fileUrl: string): Promise<void>;

  /**
   * Generate a download URL (presigned for S3, direct for local)
   * @param fileUrl - Storage URL
   * @param expiresIn - Expiration time in seconds (S3 only, default 3600)
   * @returns Download URL
   */
  getDownloadUrl(fileUrl: string, expiresIn?: number): Promise<string>;

  /**
   * Check if a file exists
   * @param fileUrl - Storage URL
   * @returns True if file exists, false otherwise
   */
  exists(fileUrl: string): Promise<boolean>;

  /**
   * Get file metadata (optional, may not be implemented by all strategies)
   * @param fileUrl - Storage URL
   * @returns File metadata or null if not found
   */
  getMetadata?(fileUrl: string): Promise<FileMetadata | null>;
}

export type StorageType = 'local' | 's3';
