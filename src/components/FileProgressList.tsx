"use client";

import { FileText, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type FileStatus = "pending" | "uploading" | "processing" | "completed" | "failed";

export interface FileProgress {
  id: string;
  fileName: string;
  status: FileStatus;
  progress: number;
  error?: string;
}

interface FileProgressListProps {
  files: FileProgress[];
}

export function FileProgressList({ files }: FileProgressListProps) {
  if (files.length === 0) return null;

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing with AI...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
    }
  };

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return "text-muted-foreground";
      case "uploading":
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
      <h3 className="font-semibold mb-3">
        Processing Files ({files.filter(f => f.status === "completed").length}/{files.length})
      </h3>
      <div className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate">{file.fileName}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {getStatusIcon(file.status)}
                <span className={`text-xs font-medium ${getStatusColor(file.status)}`}>
                  {getStatusText(file.status)}
                </span>
              </div>
            </div>

            {(file.status === "uploading" || file.status === "processing") && (
              <Progress value={file.progress} className="h-2" />
            )}

            {file.error && (
              <p className="text-xs text-destructive">{file.error}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
