"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
}

interface BulkVendorAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInvoiceIds: string[];
  onSuccess: () => void;
}

export function BulkVendorAssignment({
  open,
  onOpenChange,
  selectedInvoiceIds,
  onSuccess,
}: BulkVendorAssignmentProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      fetchVendors();
      setSelectedVendorId("");
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendors");
      const data = await response.json();
      if (data.success) {
        setVendors(data.vendors);
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setError("Failed to load vendors");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/invoices/bulk-assign-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: selectedInvoiceIds,
          vendorId: selectedVendorId === "unassign" ? null : selectedVendorId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign vendor");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Vendor to Invoices</DialogTitle>
          <DialogDescription>
            Assign a vendor to {selectedInvoiceIds.length} selected invoice
            {selectedInvoiceIds.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="vendor">Select Vendor</Label>
            <Select
              value={selectedVendorId}
              onValueChange={setSelectedVendorId}
              disabled={loading}
            >
              <SelectTrigger id="vendor">
                <SelectValue placeholder="Choose a vendor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">Remove Vendor Assignment</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Select a vendor to assign, or choose "Remove Vendor Assignment" to unassign
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              <Check className="h-4 w-4 flex-shrink-0" />
              <p>Vendor assigned successfully!</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedVendorId}>
              {loading ? "Assigning..." : "Assign Vendor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
