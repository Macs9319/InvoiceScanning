"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";

interface CreateRequestDialogProps {
  onSuccess?: (requestId: string) => void;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export function CreateRequestDialog({ onSuccess }: CreateRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autoProcess, setAutoProcess] = useState(false);
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const router = useRouter();

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
    disabled: loading,
  });

  const removeFile = (index: number) => {
    if (!loading) {
      setFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create the request
      setUploadProgress("Creating request...");
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          autoProcess,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create request");
      }

      const data = await response.json();
      const requestId = data.request.id;

      // Step 2: Upload files if any
      if (files.length > 0) {
        setUploadProgress(`Uploading files (0/${files.length})...`);

        for (let i = 0; i < files.length; i++) {
          const fileStatus = files[i];

          // Update status to uploading
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'uploading', progress: 0 } : f
          ));

          try {
            const formData = new FormData();
            formData.append("files", fileStatus.file);
            formData.append("requestId", requestId);

            // Simulate progress
            const progressInterval = setInterval(() => {
              setFiles(prev => prev.map((f, idx) =>
                idx === i && f.progress < 90
                  ? { ...f, progress: f.progress + 10 }
                  : f
              ));
            }, 200);

            const uploadResponse = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            clearInterval(progressInterval);

            if (!uploadResponse.ok) {
              const uploadError = await uploadResponse.json();
              throw new Error(uploadError.error || "Upload failed");
            }

            // Mark as completed
            setFiles(prev => prev.map((f, idx) =>
              idx === i
                ? { ...f, status: 'completed', progress: 100 }
                : f
            ));

            setUploadProgress(`Uploading files (${i + 1}/${files.length})...`);
          } catch (uploadError: any) {
            console.error(`Error uploading ${fileStatus.file.name}:`, uploadError);

            // Mark as error
            setFiles(prev => prev.map((f, idx) =>
              idx === i
                ? { ...f, status: 'error', error: uploadError.message }
                : f
            ));
          }
        }
      }

      // Reset form
      setTitle("");
      setDescription("");
      setAutoProcess(false);
      setFiles([]);
      setUploadProgress("");
      setOpen(false);

      // Call success callback or navigate to request detail
      if (onSuccess) {
        onSuccess(requestId);
      } else {
        router.push(`/requests/${requestId}`);
      }

      router.refresh();
    } catch (error: any) {
      console.error("Error creating request:", error);
      alert(error.message || "Failed to create request");
      setUploadProgress("");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!loading) {
      setOpen(newOpen);
      if (!newOpen) {
        // Reset state when closing
        setTitle("");
        setDescription("");
        setAutoProcess(false);
        setFiles([]);
        setUploadProgress("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Request</DialogTitle>
            <DialogDescription>
              Create a request and optionally upload invoices to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g., December 2025 Expenses"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for auto-generated title
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add notes about this batch..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={5000}
                disabled={loading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoProcess"
                checked={autoProcess}
                onCheckedChange={(checked) => setAutoProcess(checked as boolean)}
                disabled={loading}
              />
              <Label
                htmlFor="autoProcess"
                className="text-sm font-normal cursor-pointer"
              >
                Auto-process invoices when uploaded
              </Label>
            </div>

            {/* File Upload Section */}
            <div className="grid gap-2">
              <Label>Files (optional)</Label>

              {/* Dropzone */}
              {!loading && (
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {isDragActive ? (
                    <p className="text-sm">Drop files here...</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1">
                        Drag & drop PDF files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse (max 10MB per file)
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {files.length} file(s) selected
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-2">
                    {files.map((fileStatus, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                      >
                        <div className="flex-shrink-0">
                          {fileStatus.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : fileStatus.status === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : fileStatus.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
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

                        {!loading && fileStatus.status !== 'completed' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0 h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress message */}
              {uploadProgress && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploadProgress}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {files.length > 0 ? 'Create & Upload' : 'Create Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
