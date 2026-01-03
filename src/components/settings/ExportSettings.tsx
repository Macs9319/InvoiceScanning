"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ExportSettingsProps {
  settings: {
    defaultExportFormat: string | null;
    exportFilenameTemplate: string | null;
  };
  onSave: (data: any) => Promise<void>;
}

export function ExportSettings({ settings, onSave }: ExportSettingsProps) {
  const [defaultExportFormat, setDefaultExportFormat] = useState(
    settings.defaultExportFormat || "excel"
  );
  const [exportFilenameTemplate, setExportFilenameTemplate] = useState(
    settings.exportFilenameTemplate || "{date}_{invoiceNumber}"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ defaultExportFormat, exportFilenameTemplate });
      alert("Export settings saved successfully!");
    } catch (error) {
      console.error("Error saving export settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    defaultExportFormat !== (settings.defaultExportFormat || "excel") ||
    exportFilenameTemplate !== (settings.exportFilenameTemplate || "{date}_{invoiceNumber}");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          Configure export settings and file naming
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Export Format */}
        <div className="space-y-2">
          <Label htmlFor="defaultExportFormat">Default Export Format</Label>
          <Select value={defaultExportFormat} onValueChange={setDefaultExportFormat}>
            <SelectTrigger id="defaultExportFormat">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
              <SelectItem value="json">JSON (.json)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Your preferred export format
          </p>
        </div>

        {/* Export Filename Template */}
        <div className="space-y-2">
          <Label htmlFor="exportFilenameTemplate">Filename Template</Label>
          <Input
            id="exportFilenameTemplate"
            type="text"
            value={exportFilenameTemplate}
            onChange={(e) => setExportFilenameTemplate(e.target.value)}
            placeholder="{date}_{invoiceNumber}"
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Available placeholders: {"{date}"}, {"{invoiceNumber}"}, {"{vendorName}"}
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
