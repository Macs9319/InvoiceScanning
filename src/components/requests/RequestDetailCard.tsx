"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RequestWithRelations } from "@/types/request";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { formatDate } from "@/lib/utils";
import { Edit, Calendar, User, Loader2, Play, RefreshCw } from "lucide-react";

interface RequestDetailCardProps {
  request: RequestWithRelations;
  onUpdate?: () => void;
  onSubmit?: () => void;
  onRetry?: () => void;
}

export function RequestDetailCard({
  request,
  onUpdate,
  onSubmit,
  onRetry,
}: RequestDetailCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(request.title || "");
  const [description, setDescription] = useState(request.description || "");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update request");
      }

      setEditDialogOpen(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Error updating request:", error);
      alert(error.message || "Failed to update request");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = request.status === 'draft' && request.totalInvoices > 0;
  const canRetry = (request.status === 'failed' || request.status === 'partial') && request.failedCount > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">
              {request.title || <span className="text-muted-foreground italic">Untitled Request</span>}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <RequestStatusBadge status={request.status} />
              {request.defaultVendor && (
                <Badge variant="outline">
                  Vendor: {request.defaultVendor.name}
                </Badge>
              )}
              {request.autoProcess && (
                <Badge variant="secondary">Auto-Process</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canSubmit && onSubmit && (
              <Button onClick={onSubmit} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Submit
              </Button>
            )}
            {canRetry && onRetry && (
              <Button onClick={onRetry} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Failed
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">Created</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(request.createdAt)}
                </div>
              </div>
            </div>

            {request.submittedAt && (
              <div className="flex items-start gap-3">
                <Play className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Submitted</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(request.submittedAt)}
                  </div>
                </div>
              </div>
            )}

            {request.completedAt && (
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Completed</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(request.completedAt)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">Request ID</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {request.id.slice(0, 8)}...
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Request</DialogTitle>
              <DialogDescription>
                Update the request title and description
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="Request title..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Add notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
