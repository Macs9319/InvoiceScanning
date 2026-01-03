"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { LogOut, Building2, FolderKanban, UserCircle } from "lucide-react";

export function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="absolute right-4 top-4 flex items-center gap-3">
      {status === "loading" ? (
        <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
      ) : session?.user ? (
        <div className="flex items-center gap-3">
          <Link href="/requests">
            <Button variant="ghost" size="sm">
              <FolderKanban className="h-4 w-4 mr-2" />
              Requests
            </Button>
          </Link>
          <Link href="/vendors">
            <Button variant="ghost" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              Vendors
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="ghost" size="sm">
              <UserCircle className="h-4 w-4 mr-2" />
              {session.user.name || session.user.email}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
          Sign In
        </Button>
      )}
      <ThemeToggle />
    </div>
  );
}
