import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/mailer";
import { getVerificationEmailTemplate } from "@/lib/email/templates";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Generate verification token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Send verification email
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:3000`;
      const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
      const { subject, html, text } = getVerificationEmailTemplate(verificationUrl, name);

      await sendEmail({
        to: email,
        subject,
        html,
        text,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail the signup if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
