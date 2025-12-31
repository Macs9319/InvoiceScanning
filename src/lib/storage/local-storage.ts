/**
 * Local Filesystem Storage Implementation
 *
 * Implements the StorageStrategy interface for local filesystem storage.
 * Provides backward compatibility for existing files stored in public/uploads/.
 */

import { StorageStrategy, FileMetadata } from './storage-strategy';
import { readFile, writeFile, unlink, access, mkdir } from 'fs/promises';
import { join } from 'path';

export class LocalStorage implements StorageStrategy {
  private uploadsDir = join(process.cwd(), 'public', 'uploads');

  /**
   * Upload file to local filesystem
   * @param buffer - File buffer
   * @param key - Storage key (filename is extracted from key)
   * @param metadata - Optional metadata (not used for local storage)
   * @returns Relative URL path (e.g., "/uploads/filename.pdf")
   */
  async upload(buffer: Buffer, key: string, metadata?: FileMetadata): Promise<string> {
    // Ensure uploads directory exists
    await mkdir(this.uploadsDir, { recursive: true });

    // Extract filename from key (key might be "users/userId/invoices/file.pdf")
    const filename = key.split('/').pop() || key;
    const filepath = join(this.uploadsDir, filename);

    // Write file to disk
    await writeFile(filepath, buffer);

    // Return relative URL path
    return `/uploads/${filename}`;
  }

  /**
   * Read file from local filesystem
   * @param fileUrl - Relative URL path (e.g., "/uploads/filename.pdf")
   * @returns File buffer
   * @throws Error if file not found
   */
  async read(fileUrl: string): Promise<Buffer> {
    // Remove leading slash and 'uploads/' prefix
    const filename = fileUrl.replace(/^\/uploads\//, '');
    const filepath = join(this.uploadsDir, filename);

    try {
      return await readFile(filepath);
    } catch (error: any) {
      throw new Error(
        `Failed to read file from local storage: ${fileUrl} - ${error.message}`
      );
    }
  }

  /**
   * Delete file from local filesystem
   * @param fileUrl - Relative URL path
   * @throws Logs error but doesn't throw (graceful degradation)
   */
  async delete(fileUrl: string): Promise<void> {
    const filename = fileUrl.replace(/^\/uploads\//, '');
    const filepath = join(this.uploadsDir, filename);

    try {
      await unlink(filepath);
    } catch (error) {
      // Log error but don't throw - file might already be deleted
      console.error(`Error deleting local file ${fileUrl}:`, error);
    }
  }

  /**
   * Generate download URL for local file
   * For local storage, return the public URL directly (no presigned URL needed)
   * @param fileUrl - Relative URL path
   * @returns Same relative URL (files are publicly accessible in Next.js)
   */
  async getDownloadUrl(fileUrl: string): Promise<string> {
    // For local storage, files in public/ are directly accessible
    // Return the same path (Next.js serves /public files)
    return fileUrl;
  }

  /**
   * Check if file exists on local filesystem
   * @param fileUrl - Relative URL path
   * @returns True if file exists, false otherwise
   */
  async exists(fileUrl: string): Promise<boolean> {
    const filename = fileUrl.replace(/^\/uploads\//, '');
    const filepath = join(this.uploadsDir, filename);

    try {
      await access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata (not implemented for local storage)
   * @param fileUrl - Relative URL path
   * @returns null (metadata not stored for local files)
   */
  async getMetadata(fileUrl: string): Promise<FileMetadata | null> {
    // Metadata not stored for local files
    return null;
  }
}
