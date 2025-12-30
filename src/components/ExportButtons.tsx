"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExportButtons() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: "excel" | "csv" | "json") => {
    setExporting(format);
    try {
      const response = await fetch(`/api/export?format=${format}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `invoices.${format === "excel" ? "xlsx" : format}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to export invoices"
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => handleExport("excel")}
        disabled={exporting !== null}
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        {exporting === "excel" ? "Exporting..." : "Export Excel"}
      </Button>

      <Button
        variant="outline"
        onClick={() => handleExport("csv")}
        disabled={exporting !== null}
      >
        <FileText className="w-4 h-4 mr-2" />
        {exporting === "csv" ? "Exporting..." : "Export CSV"}
      </Button>

      <Button
        variant="outline"
        onClick={() => handleExport("json")}
        disabled={exporting !== null}
      >
        <FileJson className="w-4 h-4 mr-2" />
        {exporting === "json" ? "Exporting..." : "Export JSON"}
      </Button>
    </div>
  );
}
