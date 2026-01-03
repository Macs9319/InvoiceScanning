"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { status } = useSession();
    const pathname = usePathname();

    // Paths where we don't want the sidebar (e.g. login, public pages if any)
    // Assuming all pages currently require auth except login/signup/forgot-password/etc.
    // But based on header logic, it showed 'Sign In' button if not authenticated.
    // The user wants to "transfer to left navigation bar".
    // If the user is NOT authenticated, the original header showed a "Sign In" button.
    // If we move to a sidebar, we probably only want to show it when authenticated.

    const isAuthPage =
        pathname?.startsWith("/login") ||
        pathname?.startsWith("/register") ||
        pathname?.startsWith("/forgot-password") ||
        pathname?.startsWith("/reset-password") ||
        pathname?.startsWith("/verify-email");

    const isAuthenticated = status === "authenticated";

    if (isAuthPage || !isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
