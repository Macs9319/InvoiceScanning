"use client";

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Trash2, ArrowUpDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  _count: {
    templates: number;
    invoices: number;
  };
}

interface VendorTableProps {
  vendors: Vendor[];
  loading: boolean;
  onVendorClick: (vendor: Vendor) => void;
  onRefresh: () => void;
}

export function VendorTable({ vendors, loading, onVendorClick, onRefresh }: VendorTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columnHelper = createColumnHelper<Vendor>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2"
            >
              Vendor Name
              <ArrowUpDown className="ml-2 h-3 w-3" />
            </Button>
          );
        },
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.display({
        id: 'templates',
        header: 'Templates',
        cell: (info) => {
          const count = info.row.original._count?.templates || 0;
          return (
            <Badge variant="secondary" className="font-normal">
              {count}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: 'invoices',
        header: 'Invoices',
        cell: (info) => {
          const count = info.row.original._count?.invoices || 0;
          return (
            <Badge variant="outline" className="font-normal">
              {count}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onVendorClick(info.row.original)}
              className="h-8 w-8"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setVendorToDelete(info.row.original.id);
                setDeleteDialogOpen(true);
              }}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Delete vendor"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      }),
    ],
    [columnHelper, onVendorClick]
  );

  const table = useReactTable({
    data: vendors,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDelete = async () => {
    if (!vendorToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/vendors/${vendorToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh();
        setDeleteDialogOpen(false);
        setVendorToDelete(null);
      } else {
        const data = await response.json();
        alert(`Failed to delete vendor: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
      alert('Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No vendors yet</p>
        <p className="text-sm">Create a vendor to get started with custom templates</p>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vendor and all associated templates.
              Invoices linked to this vendor will remain but the vendor link will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
