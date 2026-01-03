import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NextAuthProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Invoice Scanner - AI-Powered PDF Processing",
  description: "Upload and process invoices, receipts, and payment-related PDFs with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <NextAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppShell>
              {children}
            </AppShell>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
