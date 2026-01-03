"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileForm } from "@/components/ProfileForm";
import { AccountStats } from "@/components/AccountStats";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  accounts: Array<{
    provider: string;
    providerAccountId: string;
  }>;
}

interface AccountStatsData {
  invoices: {
    total: number;
    processed: number;
    failed: number;
    pending: number;
    recent: number;
    successRate: number;
  };
  spending: {
    total: number;
    currency: string;
  };
  vendors: {
    total: number;
  };
  requests: {
    total: number;
    completed: number;
  };
  storage: {
    estimatedMB: number;
    unit: string;
  };
  account: {
    ageDays: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<AccountStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      alert("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/profile/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      // Don't block the page if stats fail
    }
  };

  const handleAvatarUpload = (imageUrl: string) => {
    if (user) {
      setUser({ ...user, image: imageUrl });
    }
  };

  const handleAvatarDelete = () => {
    if (user) {
      setUser({ ...user, image: null });
    }
  };

  const handleProfileUpdate = (name: string) => {
    if (user) {
      setUser({ ...user, name });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Profile not found</p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="mt-4"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and view your statistics
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left Column - Avatar */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-6">
            <AvatarUpload
              currentImage={user.image}
              userName={user.name}
              onUploadSuccess={handleAvatarUpload}
              onDeleteSuccess={handleAvatarDelete}
            />
          </div>
        </div>

        {/* Right Column - Profile Form */}
        <div className="space-y-6">
          <ProfileForm user={user} onUpdateSuccess={handleProfileUpdate} />
        </div>
      </div>

      {/* Statistics Section */}
      {stats && (
        <div className="mt-8">
          <AccountStats stats={stats} />
        </div>
      )}
    </div>
  );
}
