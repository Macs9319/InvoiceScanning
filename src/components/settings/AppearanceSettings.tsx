"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AppearanceSettingsProps {
  settings: {
    theme: string | null;
    locale: string | null;
    dateFormat: string | null;
  };
  onSave: (data: any) => Promise<void>;
}

export function AppearanceSettings({ settings, onSave }: AppearanceSettingsProps) {
  const [theme, setTheme] = useState(settings.theme || "system");
  const [locale, setLocale] = useState(settings.locale || "en");
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || "MM/DD/YYYY");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ theme, locale, dateFormat });
      alert("Appearance settings saved successfully!");
    } catch (error) {
      console.error("Error saving appearance settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    theme !== (settings.theme || "system") ||
    locale !== (settings.locale || "en") ||
    dateFormat !== (settings.dateFormat || "MM/DD/YYYY");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the application looks and feels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme */}
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger id="theme">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose your preferred color theme
          </p>
        </div>

        {/* Locale */}
        <div className="space-y-2">
          <Label htmlFor="locale">Language</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="locale">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="zh">Chinese</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select your preferred language
          </p>
        </div>

        {/* Date Format */}
        <div className="space-y-2">
          <Label htmlFor="dateFormat">Date Format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger id="dateFormat">
              <SelectValue placeholder="Select date format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Europe)</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose how dates are displayed
          </p>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
