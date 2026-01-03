"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import {
    LayoutDashboard,
    FolderKanban,
    Building2,
    Settings,
    LogOut,
    UserCircle,
    Menu,
} from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut({ redirect: false });
        router.push("/login");
        router.refresh();
    };

    const links = [
        {
            href: "/",
            label: "Dashboard",
            icon: LayoutDashboard,
            active: pathname === "/",
        },
        {
            href: "/requests",
            label: "Requests",
            icon: FolderKanban,
            active: pathname?.startsWith("/requests"),
        },
        {
            href: "/vendors",
            label: "Vendors",
            icon: Building2,
            active: pathname?.startsWith("/vendors"),
        },
        {
            href: "/settings",
            label: "Settings",
            icon: Settings,
            active: pathname?.startsWith("/settings"),
        },
    ];

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
            <div className="flex h-16 items-center border-b px-6">
                <h2 className="text-xl font-bold tracking-tight">Invoice Scanner</h2>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                <nav className="grid gap-1 px-2">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href}>
                            <Button
                                variant={link.active ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-2",
                                    link.active && "bg-secondary"
                                )}
                            >
                                <link.icon className="h-4 w-4" />
                                {link.label}
                            </Button>
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="border-t p-4">
                <Link href="/profile">
                    <div className="flex items-center gap-2 px-2 py-4 hover:bg-muted/50 rounded-md cursor-pointer transition-colors mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <UserCircle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="truncate text-sm font-medium">
                                {session?.user?.name || "User"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {session?.user?.email}
                            </span>
                        </div>
                    </div>
                </Link>

                <div className="flex gap-2">
                    <ThemeToggle />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSignOut}
                        className="flex-1"
                        title="Sign Out"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
