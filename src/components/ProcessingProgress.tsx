"use client";

import { FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type ProcessingStatus = "processing" | "completed" | "failed";

export interface ProcessingFile {
  id: string;
  fileName: string;
  status: ProcessingStatus;
  error?: string;
}

interface ProcessingProgressProps {
  files: ProcessingFile[];
}

export function ProcessingProgress({ files }: ProcessingProgressProps) {
  if (files.length === 0) return null;

  const completed = files.filter((f) => f.status === "completed").length;
  const failed = files.filter((f) => f.status === "failed").length;
  const processing = files.filter((f) => f.status === "processing").length;
  const totalProgress = (completed / files.length) * 100;

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: ProcessingStatus) => {
    switch (status) {
      case "processing":
        return "Processing with AI...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
    }
  };

  const getStatusColor = (status: ProcessingStatus) => {
    switch (status) {
      case "processing":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-destructive";
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">
              Processing Invoices ({completed}/{files.length})
            </h3>
            <div className="text-sm text-muted-foreground">
              {processing > 0 && <span>{processing} in progress</span>}
              {failed > 0 && <span className="text-destructive ml-2">{failed} failed</span>}
            </div>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{file.fileName}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {getStatusIcon(file.status)}
                <span className={`text-xs font-medium ${getStatusColor(file.status)}`}>
                  {getStatusText(file.status)}
                </span>
              </div>
              {file.error && (
                <div className="col-span-2 mt-1">
                  <p className="text-xs text-destructive">{file.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
