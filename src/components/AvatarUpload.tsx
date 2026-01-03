"use client";

import { useState, useRef } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AvatarUploadProps {
  currentImage: string | null;
  userName: string | null;
  onUploadSuccess: (imageUrl: string) => void;
  onDeleteSuccess: () => void;
}

export function AvatarUpload({
  currentImage,
  userName,
  onUploadSuccess,
  onDeleteSuccess,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user initials for default avatar
  const getUserInitials = () => {
    if (!userName) return "U";
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      const data = await response.json();
      onUploadSuccess(data.user.image);
      alert("Avatar uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      alert(error.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove avatar");
      }

      onDeleteSuccess();
      setShowDeleteDialog(false);
      alert("Avatar removed successfully!");
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      alert(error.message || "Failed to remove avatar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar Display */}
      <div className="relative">
        <div className="h-32 w-32 rounded-full border-4 border-background shadow-lg overflow-hidden bg-muted flex items-center justify-center">
          {currentImage ? (
            <img
              src={currentImage}
              alt={userName || "User avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-4xl font-semibold text-muted-foreground">
              {getUserInitials()}
            </div>
          )}
        </div>

        {/* Upload Button Overlay */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          title="Change avatar"
        >
          {uploading ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload New
        </Button>

        {currentImage && !currentImage.startsWith("http") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={uploading || deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        JPEG, PNG, GIF, or WebP. Max 5MB.
      </p>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Avatar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your avatar? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
