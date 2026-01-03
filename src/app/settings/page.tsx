"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palette, Bell, Cog, FileDown, Shield } from "lucide-react";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ProcessingSettings } from "@/components/settings/ProcessingSettings";
import { ExportSettings } from "@/components/settings/ExportSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

interface UserSettings {
  id: string;
  userId: string;
  theme: string | null;
  locale: string | null;
  dateFormat: string | null;
  emailOnSuccess: boolean;
  emailOnFailure: boolean;
  weeklySummary: boolean;
  defaultCurrency: string | null;
  autoProcessOnUpload: boolean;
  pdfRetentionDays: number | null;
  defaultExportFormat: string | null;
  exportFilenameTemplate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    checkPassword();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      alert("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const checkPassword = async () => {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        // Check if user has password (not OAuth-only)
        setHasPassword(data.user.accounts.length === 0 || data.user.password !== null);
      }
    } catch (error) {
      console.error("Error checking password:", error);
    }
  };

  const handleSaveSettings = async (data: any) => {
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }

      const result = await response.json();
      setSettings(result.settings);
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Settings not found</p>
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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your application preferences and configurations
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="processing" className="gap-2">
            <Cog className="h-4 w-4" />
            <span className="hidden sm:inline">Processing</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <AppearanceSettings
            settings={{
              theme: settings.theme,
              locale: settings.locale,
              dateFormat: settings.dateFormat,
            }}
            onSave={handleSaveSettings}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings
            settings={{
              emailOnSuccess: settings.emailOnSuccess,
              emailOnFailure: settings.emailOnFailure,
              weeklySummary: settings.weeklySummary,
            }}
            onSave={handleSaveSettings}
          />
        </TabsContent>

        <TabsContent value="processing">
          <ProcessingSettings
            settings={{
              defaultCurrency: settings.defaultCurrency,
              autoProcessOnUpload: settings.autoProcessOnUpload,
              pdfRetentionDays: settings.pdfRetentionDays,
            }}
            onSave={handleSaveSettings}
          />
        </TabsContent>

        <TabsContent value="export">
          <ExportSettings
            settings={{
              defaultExportFormat: settings.defaultExportFormat,
              exportFilenameTemplate: settings.exportFilenameTemplate,
            }}
            onSave={handleSaveSettings}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings hasPassword={hasPassword} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
