"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AddFilesDialogProps {
  requestId: string;
  onSuccess?: () => void;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export function AddFilesDialog({ requestId, onSuccess }: AddFilesDialogProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileUploadStatus[] = acceptedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploading,
  });

  const removeFile = (index: number) => {
    if (!uploading) {
      setFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      // Skip if already completed or has error
      if (fileStatus.status === 'completed') continue;

      // Update status to uploading
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        const formData = new FormData();
        formData.append("files", fileStatus.file);
        formData.append("requestId", requestId);

        // Simulate progress (since fetch doesn't provide upload progress easily)
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map((f, idx) =>
            idx === i && f.progress < 90
              ? { ...f, progress: f.progress + 10 }
              : f
          ));
        }, 200);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        // Mark as completed
        setFiles(prev => prev.map((f, idx) =>
          idx === i
            ? { ...f, status: 'completed', progress: 100 }
            : f
        ));
      } catch (error: any) {
        console.error(`Error uploading ${fileStatus.file.name}:`, error);

        // Mark as error
        setFiles(prev => prev.map((f, idx) =>
          idx === i
            ? { ...f, status: 'error', error: error.message }
            : f
        ));
      }
    }

    setUploading(false);

    // Check if all files completed successfully
    const allCompleted = files.every(f => f.status === 'completed');
    if (allCompleted && onSuccess) {
      // Small delay to show completion state
      setTimeout(() => {
        setOpen(false);
        setFiles([]);
        onSuccess();
      }, 500);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!uploading) {
      setOpen(newOpen);
      if (!newOpen) {
        // Reset state when closing
        setFiles([]);
      }
    }
  };

  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const canUpload = files.length > 0 && !uploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Add Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Files to Request</DialogTitle>
          <DialogDescription>
            Upload PDF invoices to add them to this request. Maximum file size: 10MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          {files.length === 0 || !uploading ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
                }
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg font-medium">Drop files here...</p>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">
                    Drag & drop PDF files here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (max 10MB per file)
                  </p>
                </>
              )}
            </div>
          ) : null}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{files.length} file(s) selected</span>
                {uploading && (
                  <span>{completedCount} / {files.length} completed</span>
                )}
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2">
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-shrink-0">
                      {fileStatus.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : fileStatus.status === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : fileStatus.status === 'uploading' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileStatus.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {fileStatus.status === 'uploading' && (
                        <Progress value={fileStatus.progress} className="h-1 mt-1" />
                      )}
                      {fileStatus.status === 'error' && fileStatus.error && (
                        <p className="text-xs text-destructive mt-1">
                          {fileStatus.error}
                        </p>
                      )}
                    </div>

                    {!uploading && fileStatus.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Cancel'}
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={!canUpload}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {files.length} File(s)
                </>
              )}
            </Button>
          </div>

          {errorCount > 0 && !uploading && (
            <div className="text-sm text-destructive">
              {errorCount} file(s) failed to upload. You can remove them and try again.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
