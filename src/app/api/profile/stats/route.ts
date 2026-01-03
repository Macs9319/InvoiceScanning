import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/profile/stats
 * Get current user's account statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch statistics in parallel
    const [
      totalInvoices,
      processedInvoices,
      failedInvoices,
      pendingInvoices,
      totalVendors,
      totalRequests,
      completedRequests,
      recentInvoices,
    ] = await Promise.all([
      // Total invoices count
      prisma.invoice.count({
        where: { userId: session.user.id },
      }),

      // Processed invoices count
      prisma.invoice.count({
        where: {
          userId: session.user.id,
          status: "processed",
        },
      }),

      // Failed invoices count
      prisma.invoice.count({
        where: {
          userId: session.user.id,
          status: {
            in: ["failed", "validation_failed"],
          },
        },
      }),

      // Pending invoices count
      prisma.invoice.count({
        where: {
          userId: session.user.id,
          status: "pending",
        },
      }),

      // Total vendors count
      prisma.vendor.count({
        where: { userId: session.user.id },
      }),

      // Total requests count
      prisma.uploadRequest.count({
        where: { userId: session.user.id },
      }),

      // Completed requests count
      prisma.uploadRequest.count({
        where: {
          userId: session.user.id,
          status: "completed",
        },
      }),

      // Recent invoices (last 30 days)
      prisma.invoice.count({
        where: {
          userId: session.user.id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        },
      }),
    ]);

    // Calculate total amount spent (from processed invoices)
    const totalSpending = await prisma.invoice.aggregate({
      where: {
        userId: session.user.id,
        status: "processed",
        totalAmount: { not: null },
      },
      _sum: {
        totalAmount: true,
      },
    });

    // Get storage usage (sum of invoice file sizes would require S3 API calls)
    // For now, we'll estimate based on invoice count
    const estimatedStorageMB = totalInvoices * 0.5; // Assume ~500KB per invoice

    // Calculate success rate
    const successRate = totalInvoices > 0
      ? Math.round((processedInvoices / totalInvoices) * 100)
      : 0;

    // Get user's account age in days
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    });

    const accountAgeDays = user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Prepare statistics
    const stats = {
      invoices: {
        total: totalInvoices,
        processed: processedInvoices,
        failed: failedInvoices,
        pending: pendingInvoices,
        recent: recentInvoices, // Last 30 days
        successRate,
      },
      spending: {
        total: totalSpending._sum.totalAmount || 0,
        currency: "USD", // Could be made dynamic based on user preference
      },
      vendors: {
        total: totalVendors,
      },
      requests: {
        total: totalRequests,
        completed: completedRequests,
      },
      storage: {
        estimatedMB: Math.round(estimatedStorageMB * 100) / 100,
        unit: "MB",
      },
      account: {
        ageDays: accountAgeDays,
      },
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching account statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
