"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { History, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface TopBarProps {
  historyCount?: number;
}

export function TopBar({ historyCount = 0 }: TopBarProps) {
  const { data: session } = useSession();

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-sm border-b">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Invoice Scanner</h1>
          <p className="text-xs text-muted-foreground">AI-powered document analysis</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/requests">
          <Button variant="outline" className="gap-2 rounded-full px-4">
            <History className="w-4 h-4" />
            <span>History</span>
            {historyCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {historyCount}
              </Badge>
            )}
          </Button>
        </Link>

        <Link href="/profile">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity">
            {getInitials(session?.user?.name, session?.user?.email)}
          </div>
        </Link>
      </div>
    </div>
  );
}
