"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProcessingSettingsProps {
  settings: {
    defaultCurrency: string | null;
    autoProcessOnUpload: boolean;
    pdfRetentionDays: number | null;
  };
  onSave: (data: any) => Promise<void>;
}

export function ProcessingSettings({ settings, onSave }: ProcessingSettingsProps) {
  const [defaultCurrency, setDefaultCurrency] = useState(settings.defaultCurrency || "USD");
  const [autoProcessOnUpload, setAutoProcessOnUpload] = useState(settings.autoProcessOnUpload);
  const [pdfRetentionDays, setPdfRetentionDays] = useState(
    settings.pdfRetentionDays?.toString() || "365"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        defaultCurrency,
        autoProcessOnUpload,
        pdfRetentionDays: parseInt(pdfRetentionDays, 10),
      });
      alert("Processing settings saved successfully!");
    } catch (error) {
      console.error("Error saving processing settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    defaultCurrency !== (settings.defaultCurrency || "USD") ||
    autoProcessOnUpload !== settings.autoProcessOnUpload ||
    pdfRetentionDays !== (settings.pdfRetentionDays?.toString() || "365");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          Configure how invoices are processed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Currency */}
        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Default Currency</Label>
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger id="defaultCurrency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
              <SelectItem value="GBP">GBP - British Pound</SelectItem>
              <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
              <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Currency used for new invoices by default
          </p>
        </div>

        {/* Auto-process on Upload */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="autoProcessOnUpload">Auto-process on Upload</Label>
            <p className="text-xs text-muted-foreground">
              Automatically process invoices after upload
            </p>
          </div>
          <Switch
            id="autoProcessOnUpload"
            checked={autoProcessOnUpload}
            onCheckedChange={setAutoProcessOnUpload}
          />
        </div>

        {/* PDF Retention Days */}
        <div className="space-y-2">
          <Label htmlFor="pdfRetentionDays">PDF Retention Period (days)</Label>
          <Input
            id="pdfRetentionDays"
            type="number"
            min="0"
            max="3650"
            value={pdfRetentionDays}
            onChange={(e) => setPdfRetentionDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            How long to keep PDF files (0 = keep forever)
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
