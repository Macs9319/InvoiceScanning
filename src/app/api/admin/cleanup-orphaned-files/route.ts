import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getS3Client, S3_BUCKET_NAME } from "@/lib/storage";

/**
 * Orphaned File Cleanup API
 *
 * Scans S3 bucket for files that don't have corresponding database records.
 * Can optionally delete orphaned files when called with ?delete=true parameter.
 *
 * IMPORTANT: This is an admin-only operation. In production, add proper
 * role-based access control to restrict this endpoint.
 *
 * Usage:
 * - GET /api/admin/cleanup-orphaned-files - Scan only (dry run)
 * - GET /api/admin/cleanup-orphaned-files?delete=true - Scan and delete orphans
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here in production
    // Example: if (session.user.role !== 'admin') { return 401 }

    const client = getS3Client();
    const orphanedFiles: string[] = [];
    const errors: string[] = [];

    // Check if we should delete orphaned files
    const shouldDelete = request.nextUrl.searchParams.get("delete") === "true";

    // List all objects in S3 bucket with 'users/' prefix
    let continuationToken: string | undefined;
    let totalScanned = 0;
    let totalOrphaned = 0;
    let totalDeleted = 0;

    try {
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: S3_BUCKET_NAME,
          Prefix: "users/",
          ContinuationToken: continuationToken,
        });

        const response = await client.send(listCommand);
        const objects = response.Contents || [];

        for (const object of objects) {
          if (!object.Key) continue;
          totalScanned++;

          const s3Url = `s3://${S3_BUCKET_NAME}/${object.Key}`;

          // Check if file exists in database
          const invoice = await prisma.invoice.findFirst({
            where: { fileUrl: s3Url },
            select: { id: true },
          });

          if (!invoice) {
            // File is orphaned
            orphanedFiles.push(object.Key);
            totalOrphaned++;

            // Delete if requested
            if (shouldDelete) {
              try {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: S3_BUCKET_NAME,
                  Key: object.Key,
                });
                await client.send(deleteCommand);
                totalDeleted++;
              } catch (error) {
                const errorMsg = `Failed to delete ${object.Key}: ${error}`;
                errors.push(errorMsg);
                console.error(errorMsg);
              }
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    } catch (s3Error) {
      console.error("S3 operation error:", s3Error);
      return NextResponse.json(
        {
          error: "Failed to scan S3 bucket",
          details: s3Error instanceof Error ? s3Error.message : String(s3Error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalScanned,
        totalOrphaned,
        totalDeleted: shouldDelete ? totalDeleted : 0,
        dryRun: !shouldDelete,
      },
      orphanedFiles: orphanedFiles.slice(0, 100), // Return first 100 for review
      totalOrphanedCount: orphanedFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      message: shouldDelete
        ? `Deleted ${totalDeleted} of ${totalOrphaned} orphaned files`
        : `Found ${totalOrphaned} orphaned files. Use ?delete=true to remove them.`,
    });
  } catch (error) {
    console.error("Orphaned file cleanup error:", error);
    return NextResponse.json(
      {
        error: "Failed to cleanup orphaned files",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
