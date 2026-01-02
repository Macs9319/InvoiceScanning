"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Loader2 } from "lucide-react";

interface CreateRequestDialogProps {
  onSuccess?: (requestId: string) => void;
}

export function CreateRequestDialog({ onSuccess }: CreateRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autoProcess, setAutoProcess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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

      // Reset form
      setTitle("");
      setDescription("");
      setAutoProcess(false);
      setOpen(false);

      // Call success callback or navigate to request detail
      if (onSuccess) {
        onSuccess(data.request.id);
      } else {
        router.push(`/requests/${data.request.id}`);
      }

      router.refresh();
    } catch (error: any) {
      console.error("Error creating request:", error);
      alert(error.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Request</DialogTitle>
            <DialogDescription>
              Create a named request to group and track invoice uploads. Leave title empty for auto-generated name.
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
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for auto-generated title like "Batch 2026-01-02 14:30"
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add notes about this batch..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoProcess"
                checked={autoProcess}
                onCheckedChange={(checked) => setAutoProcess(checked as boolean)}
              />
              <Label
                htmlFor="autoProcess"
                className="text-sm font-normal cursor-pointer"
              >
                Auto-process invoices when uploaded (experimental)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
