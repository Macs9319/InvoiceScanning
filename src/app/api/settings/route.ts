import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

// Validation schema for settings updates
const SettingsUpdateSchema = z.object({
  // Appearance
  theme: z.enum(["light", "dark", "system"]).optional(),
  locale: z.string().max(10).optional(),
  dateFormat: z.string().max(20).optional(),

  // Notifications
  emailOnSuccess: z.boolean().optional(),
  emailOnFailure: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),

  // Processing
  defaultCurrency: z.string().max(3).optional(),
  autoProcessOnUpload: z.boolean().optional(),
  pdfRetentionDays: z.number().int().min(0).max(3650).optional(),

  // Export
  defaultExportFormat: z.enum(["excel", "csv", "json"]).optional(),
  exportFilenameTemplate: z.string().max(100).optional(),
});

/**
 * GET /api/settings
 * Get current user's settings
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

    // Get or create user settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Update current user's settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = SettingsUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get or create settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings) {
      // Create with provided data
      settings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
          ...data,
        },
      });
    } else {
      // Update existing settings
      settings = await prisma.userSettings.update({
        where: { userId: session.user.id },
        data,
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
