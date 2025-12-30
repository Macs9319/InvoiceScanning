import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/mailer";
import { getPasswordResetEmailTemplate } from "@/lib/email/templates";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success even if user doesn't exist (security best practice)
    // This prevents email enumeration attacks
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with that email, a password reset link has been sent.",
      });
    }

    // Delete any existing password reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Generate password reset token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store password reset token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send password reset email
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:3000`;
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const { subject, html, text } = getPasswordResetEmailTemplate(resetUrl, user.name || undefined);

      await sendEmail({
        to: email,
        subject,
        html,
        text,
      });
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
