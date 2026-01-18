"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileProgressList, type FileProgress } from "@/components/FileProgressList";

interface FileUploadProps {
  onFilesUploaded: (files: { id: string; fileName: string }[]) => void;
}

export default function FileUpload({ onFilesUploaded }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadSingleFile = async (file: File, index: number): Promise<{ id: string; fileName: string } | null> => {
    const fileId = `temp-${index}-${Date.now()}`;

    // Initialize progress for this file
    setFileProgress((prev) => [
      ...prev,
      { id: fileId, fileName: file.name, status: "uploading", progress: 0 },
    ]);

    try {
      const formData = new FormData();
      formData.append("files", file);

      // Simulate progress updates (since fetch doesn't support upload progress easily)
      const progressInterval = setInterval(() => {
        setFileProgress((prev) =>
          prev.map((fp) =>
            fp.id === fileId && fp.progress < 90
              ? { ...fp, progress: fp.progress + 10 }
              : fp
          )
        );
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

      const data = await response.json();

      if (data.success && data.files.length > 0) {
        // Update to completed
        setFileProgress((prev) =>
          prev.map((fp) =>
            fp.id === fileId
              ? { ...fp, status: "completed", progress: 100 }
              : fp
          )
        );
        return data.files[0];
      }

      throw new Error("Upload failed");
    } catch (err) {
      // Update to failed
      setFileProgress((prev) =>
        prev.map((fp) =>
          fp.id === fileId
            ? {
                ...fp,
                status: "failed",
                progress: 0,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : fp
        )
      );
      return null;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setUploading(true);
    setError(null);
    setFileProgress([]);

    try {
      // Upload all files in parallel
      const uploadPromises = files.map((file, index) => uploadSingleFile(file, index));
      const results = await Promise.all(uploadPromises);

      // Filter out failed uploads
      const successfulUploads = results.filter((result): result is { id: string; fileName: string } => result !== null);

      if (successfulUploads.length > 0) {
        onFilesUploaded(successfulUploads);
        setFiles([]);

        // Clear progress after a delay
        setTimeout(() => {
          setFileProgress([]);
        }, 3000);
      } else {
        setError("All uploads failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
            isDragActive ? "bg-primary" : "bg-primary"
          }`}>
            <Upload className="w-8 h-8 text-white" />
          </div>
          {isDragActive ? (
            <p className="text-lg font-semibold text-primary">Drop the files here...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                Drop your files here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="text-sm">PDF files and images supported</span>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <Card className="border shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">Selected Files ({files.length})</h3>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full mt-4"
              size="lg"
            >
              {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {fileProgress.length > 0 && <FileProgressList files={fileProgress} />}
    </div>
  );
}
