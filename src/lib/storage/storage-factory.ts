/**
 * Storage Factory
 *
 * Factory pattern for creating storage strategy instances.
 * Auto-detects storage type from file URL patterns.
 */

import { StorageStrategy, StorageType } from './storage-strategy';
import { LocalStorage } from './local-storage';
import { S3Storage } from './s3-storage';
import { DEFAULT_STORAGE_PROVIDER } from './s3-client';

export class StorageFactory {
  /**
   * Determine storage type from file URL pattern
   * @param fileUrl - Storage URL
   * @returns Storage type ('local' or 's3')
   */
  static getStorageType(fileUrl: string): StorageType {
    // S3 URLs start with 's3://' or contain '.s3.'
    if (fileUrl.startsWith('s3://') || fileUrl.includes('.s3.')) {
      return 's3';
    }

    // Local filesystem URLs start with '/'
    return 'local';
  }

  /**
   * Create storage strategy based on file URL
   * Auto-detects storage type and returns appropriate implementation
   * @param fileUrl - Storage URL
   * @returns Storage strategy instance (LocalStorage or S3Storage)
   */
  static getStorageStrategy(fileUrl: string): StorageStrategy {
    const type = this.getStorageType(fileUrl);
    return this.createStrategy(type);
  }

  /**
   * Create storage strategy based on type
   * @param type - Storage type ('local' or 's3')
   * @returns Storage strategy instance
   */
  static createStrategy(type: StorageType): StorageStrategy {
    switch (type) {
      case 's3':
        return new S3Storage();
      case 'local':
        return new LocalStorage();
      default:
        throw new Error(`Unsupported storage type: ${type}`);
    }
  }

  /**
   * Get default storage strategy for new uploads
   * Uses STORAGE_PROVIDER environment variable (default: 's3')
   * @returns Storage strategy instance for new uploads
   */
  static getDefaultStrategy(): StorageStrategy {
    return this.createStrategy(DEFAULT_STORAGE_PROVIDER);
  }
}
