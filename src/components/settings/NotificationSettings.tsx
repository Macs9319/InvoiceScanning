"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NotificationSettingsProps {
  settings: {
    emailOnSuccess: boolean;
    emailOnFailure: boolean;
    weeklySummary: boolean;
  };
  onSave: (data: any) => Promise<void>;
}

export function NotificationSettings({ settings, onSave }: NotificationSettingsProps) {
  const [emailOnSuccess, setEmailOnSuccess] = useState(settings.emailOnSuccess);
  const [emailOnFailure, setEmailOnFailure] = useState(settings.emailOnFailure);
  const [weeklySummary, setWeeklySummary] = useState(settings.weeklySummary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ emailOnSuccess, emailOnFailure, weeklySummary });
      alert("Notification settings saved successfully!");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    emailOnSuccess !== settings.emailOnSuccess ||
    emailOnFailure !== settings.emailOnFailure ||
    weeklySummary !== settings.weeklySummary;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Manage how and when you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email on Success */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailOnSuccess">Success Notifications</Label>
            <p className="text-xs text-muted-foreground">
              Receive email when invoices are processed successfully
            </p>
          </div>
          <Switch
            id="emailOnSuccess"
            checked={emailOnSuccess}
            onCheckedChange={setEmailOnSuccess}
          />
        </div>

        {/* Email on Failure */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailOnFailure">Failure Notifications</Label>
            <p className="text-xs text-muted-foreground">
              Receive email when invoice processing fails
            </p>
          </div>
          <Switch
            id="emailOnFailure"
            checked={emailOnFailure}
            onCheckedChange={setEmailOnFailure}
          />
        </div>

        {/* Weekly Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="weeklySummary">Weekly Summary</Label>
            <p className="text-xs text-muted-foreground">
              Receive weekly summary of your activity
            </p>
          </div>
          <Switch
            id="weeklySummary"
            checked={weeklySummary}
            onCheckedChange={setWeeklySummary}
          />
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
