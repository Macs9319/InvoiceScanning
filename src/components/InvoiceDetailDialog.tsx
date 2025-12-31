"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceWithLineItems } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Mail, Download } from "lucide-react";
import Link from "next/link";

interface InvoiceDetailDialogProps {
  invoice: InvoiceWithLineItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: InvoiceDetailDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!invoice) return null;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "processed":
        return "default";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/invoices/download?id=${invoice.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate download URL');
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = invoice.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert(error instanceof Error ? error.message : 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Invoice Details</DialogTitle>
              <DialogDescription>
                Complete information for {invoice.fileName}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="ml-4"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : 'Download PDF'}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">
                    {invoice.invoiceNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(invoice.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p className="font-medium">{invoice.currency || "USD"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">File Name</p>
                  <p className="font-medium truncate">{invoice.fileName}</p>
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            {invoice.vendor && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Information
                </h3>
                <div className="bg-muted/50 border rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Vendor Name</p>
                      <Link
                        href="/vendors"
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3" />
                        {invoice.vendor.name}
                      </Link>
                    </div>
                    {invoice.vendor.email && (
                      <div>
                        <p className="text-muted-foreground mb-1">Email</p>
                        <a
                          href={`mailto:${invoice.vendor.email}`}
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {invoice.vendor.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* No Vendor Assigned */}
            {!invoice.vendor && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Information
                </h3>
                <div className="bg-muted/50 border border-dashed rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    No vendor assigned to this invoice.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Use the "Assign Vendor" option in the bulk actions toolbar to assign a vendor.
                  </p>
                </div>
              </div>
            )}

            {/* Error Details */}
            {invoice.status === "failed" && invoice.aiResponse && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-destructive flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-destructive"></span>
                  Error Details
                </h3>
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                  <div className="text-sm">
                    {(() => {
                      try {
                        const errorData = JSON.parse(invoice.aiResponse);
                        if (errorData.error) {
                          return (
                            <div className="space-y-2">
                              <p className="font-semibold text-destructive">
                                {errorData.error}
                              </p>
                              {errorData.timestamp && (
                                <p className="text-xs text-muted-foreground">
                                  Failed at: {new Date(errorData.timestamp).toLocaleString()}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-3">
                                💡 Tip: Click the retry button in the table to process this invoice again.
                              </p>
                            </div>
                          );
                        }
                      } catch (e) {
                        return <p className="text-destructive">An error occurred during processing.</p>;
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Line Items */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Line Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">
                          Description
                        </th>
                        <th className="text-right p-3 font-medium">Quantity</th>
                        <th className="text-right p-3 font-medium">
                          Unit Price
                        </th>
                        <th className="text-right p-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">{item.description}</td>
                          <td className="text-right p-3">
                            {item.quantity ?? "—"}
                          </td>
                          <td className="text-right p-3">
                            {item.unitPrice
                              ? formatCurrency(item.unitPrice, invoice.currency)
                              : "—"}
                          </td>
                          <td className="text-right p-3 font-medium">
                            {item.amount
                              ? formatCurrency(item.amount, invoice.currency)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw Text Preview */}
            {invoice.rawText && (
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Extracted PDF Text
                </h3>
                <div className="bg-muted p-4 rounded-lg text-xs font-mono max-h-40 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words">
                    {invoice.rawText.substring(0, 500)}
                    {invoice.rawText.length > 500 && "..."}
                  </pre>
                </div>
              </div>
            )}

            {/* AI Response */}
            {invoice.aiResponse && invoice.status !== "failed" && (
              <div>
                <h3 className="text-sm font-semibold mb-3">AI Response</h3>
                <div className="bg-muted p-4 rounded-lg text-xs font-mono max-h-40 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(JSON.parse(invoice.aiResponse), null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Metadata</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p className="font-medium">
                    {new Date(invoice.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated At</p>
                  <p className="font-medium">
                    {new Date(invoice.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
