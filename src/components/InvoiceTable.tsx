"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceWithLineItems } from "@/types/invoice";
import { Trash2, Eye, RefreshCw, AlertCircle, Download, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceDetailDialog } from "@/components/InvoiceDetailDialog";

interface InvoiceTableProps {
  invoices: InvoiceWithLineItems[];
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  loading?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

const columnHelper = createColumnHelper<InvoiceWithLineItems>();

export default function InvoiceTable({
  invoices,
  onDelete,
  onRetry,
  loading,
  selectedIds = new Set(),
  onSelectionChange
}: InvoiceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithLineItems | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const handleToggleSelection = (id: string) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const handleToggleAll = () => {
    if (!onSelectionChange) return;

    if (selectedIds.size === invoices.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(invoices.map(inv => inv.id)));
    }
  };

  const isAllSelected = invoices.length > 0 && selectedIds.size === invoices.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < invoices.length;

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onCheckedChange={handleToggleAll}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => handleToggleSelection(row.original.id)}
            aria-label="Select row"
          />
        ),
      }),
      columnHelper.accessor("invoiceNumber", {
        header: "Invoice #",
        cell: (info) => info.getValue() || "N/A",
      }),
      columnHelper.accessor("date", {
        header: "Date",
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor("fileName", {
        header: "File Name",
        cell: (info) => (
          <span className="text-sm max-w-xs truncate block">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("vendor", {
        header: "Vendor",
        cell: (info) => {
          const vendor = info.getValue();
          return vendor ? (
            <span className="text-sm">{vendor.name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.accessor("lineItems", {
        header: "Description",
        cell: (info) => {
          const items = info.getValue();
          const descriptions = items && items.length > 0
            ? items.map((item) => item.description).join(", ")
            : "N/A";
          return (
            <span className="text-sm max-w-md truncate block">
              {descriptions}
            </span>
          );
        },
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total Amount",
        cell: (info) =>
          formatCurrency(info.getValue(), info.row.original.currency),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();

          // Determine badge variant and icon based on status
          let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
          let icon = null;
          let badgeClassName = "";

          switch (status) {
            case "processed":
              variant = "default";
              break;
            case "queued":
              variant = "outline";
              badgeClassName = "bg-blue-50 text-blue-700 border-blue-200";
              icon = <Clock className="h-3 w-3 mr-1" />;
              break;
            case "processing":
              variant = "outline";
              badgeClassName = "bg-yellow-50 text-yellow-700 border-yellow-200";
              icon = <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
              break;
            case "validation_failed":
              variant = "outline";
              badgeClassName = "bg-orange-50 text-orange-700 border-orange-200";
              icon = <AlertCircle className="h-3 w-3 mr-1" />;
              break;
            case "failed":
              variant = "destructive";
              icon = <AlertCircle className="h-3 w-3 mr-1" />;
              break;
            default:
              variant = "secondary";
          }

          return (
            <div className="flex items-center gap-2">
              <Badge variant={variant} className={badgeClassName}>
                {icon}
                {status}
              </Badge>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const invoice = info.row.original;
          const isRetrying = retryingIds.has(invoice.id);
          const isDownloading = downloadingIds.has(invoice.id);
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleViewClick(invoice)}
                className="h-8 w-8"
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownloadClick(invoice.id, invoice.fileName)}
                className="h-8 w-8"
                title="Download PDF"
                disabled={isDownloading}
              >
                <Download className="h-4 w-4" />
              </Button>
              {invoice.status === "failed" && onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRetryClick(invoice.id)}
                  className="h-8 w-8 text-orange-600 hover:text-orange-700"
                  title="Retry processing"
                  disabled={isRetrying}
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteClick(invoice.id)}
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Delete invoice"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [retryingIds, downloadingIds, onRetry, selectedIds, isAllSelected, isSomeSelected]
  );

  const handleViewClick = (invoice: InvoiceWithLineItems) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  const handleRetryClick = async (id: string) => {
    if (!onRetry) return;

    setRetryingIds(prev => new Set(prev).add(id));
    try {
      await onRetry(id);
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setInvoiceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDownloadClick = async (id: string, fileName: string) => {
    setDownloadingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/invoices/download?id=${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate download URL');
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert(error instanceof Error ? error.message : 'Failed to download file');
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (invoiceToDelete && onDelete) {
      onDelete(invoiceToDelete);
    }
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No invoices found. Upload some PDFs to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              invoice and its associated file from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
