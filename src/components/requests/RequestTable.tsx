"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { RequestListItem } from "@/types/request";
import { Eye, Trash2, Play, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestStatusBadge } from "./RequestStatusBadge";

interface RequestTableProps {
  requests: RequestListItem[];
  onDelete?: (id: string) => void;
  onSubmit?: (id: string) => void;
  onRetry?: (id: string) => void;
  loading?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

const columnHelper = createColumnHelper<RequestListItem>();

export default function RequestTable({
  requests,
  onDelete,
  onSubmit,
  onRetry,
  loading,
  selectedIds = new Set(),
  onSelectionChange,
}: RequestTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const router = useRouter();

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

    if (selectedIds.size === requests.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(requests.map(req => req.id)));
    }
  };

  const isAllSelected = requests.length > 0 && selectedIds.size === requests.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < requests.length;

  const handleViewDetails = (id: string) => {
    router.push(`/requests/${id}`);
  };

  const handleDelete = (id: string) => {
    setRequestToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (requestToDelete && onDelete) {
      onDelete(requestToDelete);
    }
    setDeleteDialogOpen(false);
    setRequestToDelete(null);
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          onSelectionChange ? (
            <Checkbox
              checked={isAllSelected}
              indeterminate={isSomeSelected}
              onCheckedChange={handleToggleAll}
              aria-label="Select all"
            />
          ) : null
        ),
        cell: ({ row }) => (
          onSelectionChange ? (
            <Checkbox
              checked={selectedIds.has(row.original.id)}
              onCheckedChange={() => handleToggleSelection(row.original.id)}
              aria-label="Select row"
            />
          ) : null
        ),
      }),
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <div className="font-medium max-w-xs truncate">
            {info.getValue() || <span className="text-muted-foreground italic">Untitled</span>}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <RequestStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("totalInvoices", {
        header: "Invoices",
        cell: (info) => {
          const total = info.getValue();
          const processed = info.row.original.processedCount;
          const failed = info.row.original.failedCount;

          return (
            <div className="flex flex-col gap-1">
              <div className="font-medium">{total} total</div>
              <div className="text-xs text-muted-foreground">
                {processed > 0 && <span className="text-green-600">{processed} done</span>}
                {processed > 0 && failed > 0 && <span> • </span>}
                {failed > 0 && <span className="text-red-600">{failed} failed</span>}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total Amount",
        cell: (info) => {
          const amount = info.getValue();
          const currency = info.row.original.currency;
          return amount !== null && currency
            ? formatCurrency(amount, currency)
            : <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor("submittedAt", {
        header: "Submitted",
        cell: (info) => {
          const date = info.getValue();
          return date ? formatDate(date) : <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const request = info.row.original;
          const canSubmit = request.status === 'draft' && request.totalInvoices > 0;
          const canRetry = (request.status === 'failed' || request.status === 'partial') && request.failedCount > 0;
          const canDelete = request.status !== 'processing';

          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewDetails(request.id)}
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canSubmit && onSubmit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSubmit(request.id)}
                  title="Submit for processing"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {canRetry && onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetry(request.id)}
                  title="Retry failed invoices"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(request.id)}
                  title="Delete request"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [onDelete, onSubmit, onRetry, onSelectionChange, selectedIds, isAllSelected, isSomeSelected]
  );

  const table = useReactTable({
    data: requests,
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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No requests found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Upload invoices to automatically create a request, or create one manually.
        </p>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this request? Invoices in this request will NOT be deleted,
              but they will become orphaned (not linked to any request).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
