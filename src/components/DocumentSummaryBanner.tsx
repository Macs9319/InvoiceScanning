"use client";

import { Sparkles } from "lucide-react";

interface DocumentSummaryBannerProps {
  title: string;
  subtitle?: string;
}

export function DocumentSummaryBanner({ title, subtitle = "DOCUMENT SUMMARY" }: DocumentSummaryBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-white/80 uppercase">
            {subtitle}
          </p>
          <h2 className="text-xl font-semibold text-white mt-1">
            {title}
          </h2>
        </div>
      </div>
      {/* Decorative elements */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
      <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}
