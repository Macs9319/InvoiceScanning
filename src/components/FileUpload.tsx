"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";
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
      <Card className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-primary"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">
                Drag and drop PDF files here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to select files (max 10MB per file)
              </p>
            </div>
          )}
        </div>
      </Card>

      {files.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Selected Files ({files.length})</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-secondary rounded"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-4"
          >
            {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
          </Button>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {fileProgress.length > 0 && <FileProgressList files={fileProgress} />}
    </div>
  );
}
