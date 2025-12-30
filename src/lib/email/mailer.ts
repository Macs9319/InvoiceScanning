import nodemailer from "nodemailer";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    // If SMTP is not configured, log to console instead (for development)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log("=".repeat(80));
      console.log("📧 EMAIL (SMTP not configured - logging to console)");
      console.log("=".repeat(80));
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log("Content:");
      console.log(text || html);
      console.log("=".repeat(80));
      return { success: true, messageId: "console-log" };
    }

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Invoice Scanner"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
