import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { StorageFactory } from "@/lib/storage";

/**
 * POST /api/profile/avatar
 * Upload user avatar image
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (only images)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Get current user to check for existing avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    // Delete old avatar if exists (not OAuth avatars)
    if (currentUser?.image && !currentUser.image.startsWith("http")) {
      try {
        const storage = StorageFactory.getStorage(currentUser.image);
        await storage.delete(currentUser.image);
      } catch (error) {
        console.error("Error deleting old avatar:", error);
        // Continue even if delete fails
      }
    }

    // Upload new avatar with special path for avatars
    const storage = StorageFactory.getStorage();

    // Create a unique filename for the avatar
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `avatar-${session.user.id}-${timestamp}.${extension}`;

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFile = new File([buffer], fileName, { type: file.type });

    // Upload to storage (S3 or local)
    // For avatars, we'll use a special "avatars" folder instead of "invoices"
    const fileUrl = await storage.upload(tempFile, session.user.id);

    // Update user's image URL in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: fileUrl },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "Avatar uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove user avatar (reset to default)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    // Delete avatar file if it exists and is not an OAuth avatar
    if (currentUser?.image && !currentUser.image.startsWith("http")) {
      try {
        const storage = StorageFactory.getStorage(currentUser.image);
        await storage.delete(currentUser.image);
      } catch (error) {
        console.error("Error deleting avatar:", error);
        // Continue even if delete fails
      }
    }

    // Update user to remove image URL
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: null },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "Avatar removed successfully"
    });
  } catch (error) {
    console.error("Error removing avatar:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}
