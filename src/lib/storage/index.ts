/**
 * Storage Module Public API
 *
 * Exports all storage-related components for use throughout the application.
 * Provides convenient helper functions for common operations.
 */

// Import for internal use
import { StorageFactory } from './storage-factory';

// Export types and interfaces
export type { StorageStrategy, FileMetadata, StorageType } from './storage-strategy';

// Export storage implementations
export { LocalStorage } from './local-storage';
export { S3Storage } from './s3-storage';

// Export factory
export { StorageFactory } from './storage-factory';

// Export S3 client and configuration
export { getS3Client, S3_BUCKET_NAME, PRESIGNED_URL_EXPIRY, DEFAULT_STORAGE_PROVIDER } from './s3-client';

/**
 * Convenience function: Get storage strategy for a specific file URL
 * Auto-detects whether the file is stored locally or in S3
 * @param fileUrl - Storage URL (local or S3)
 * @returns Appropriate storage strategy instance
 */
export function getStorageForFile(fileUrl: string) {
  return StorageFactory.getStorageStrategy(fileUrl);
}

/**
 * Convenience function: Get default storage strategy for new uploads
 * Uses STORAGE_PROVIDER environment variable (default: 's3')
 * @returns Storage strategy for new uploads
 */
export function getDefaultStorage() {
  return StorageFactory.getDefaultStrategy();
}
