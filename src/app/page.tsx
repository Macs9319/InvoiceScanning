"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import FileUpload from "@/components/FileUpload";
import InvoiceTable from "@/components/InvoiceTable";
import ExportButtons from "@/components/ExportButtons";
import { InvoiceFilters, type FilterState } from "@/components/InvoiceFilters";
import { Header } from "@/components/header";
import { BulkActionsToolbar } from "@/components/BulkActionsToolbar";
import { BulkVendorAssignment } from "@/components/BulkVendorAssignment";
import { ProcessingProgress, type ProcessingFile } from "@/components/ProcessingProgress";
import { useInvoicePolling } from "@/hooks/useInvoicePolling";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceWithLineItems } from "@/types/invoice";
import { Loader2, CheckCircle2, Trash2 } from "lucide-react";

const ITEMS_PER_PAGE = 10;

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; fileName: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithLineItems[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    currency: "all",
    vendorId: "all",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
  });
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkVendorDialogOpen, setBulkVendorDialogOpen] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const response = await fetch("/api/invoices");
      const data = await response.json();
      if (data.success) {
        setInvoices(data.invoices);
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendors");
      const data = await response.json();
      if (data.success) {
        setVendors(data.vendors.map((v: any) => ({ id: v.id, name: v.name })));
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchInvoices();
      fetchVendors();
    }
  }, [status]);

  // Get IDs of invoices currently being processed (queued or processing)
  const processingInvoiceIds = useMemo(
    () => invoices
      .filter((inv) => inv.status === 'queued' || inv.status === 'processing')
      .map((inv) => inv.id),
    [invoices]
  );

  // Poll for status updates on processing invoices
  const { hasProcessingInvoices } = useInvoicePolling(processingInvoiceIds, {
    enabled: processingInvoiceIds.length > 0,
    onStatusChange: (changedStatuses) => {
      // Check if any invoices completed (processed or failed)
      const hasCompleted = changedStatuses.some(
        (s) => s.status === 'processed' || s.status === 'failed' || s.status === 'validation_failed'
      );

      if (hasCompleted) {
        // Refresh the full invoice list when processing completes
        fetchInvoices();
      }
    },
  });

  const handleFilesUploaded = (files: { id: string; fileName: string }[]) => {
    setUploadedFiles(files);
    setProcessed(false);
    setError(null);
  };

  const processSingleFile = async (file: { id: string; fileName: string }) => {
    // Initialize queued status
    setProcessingFiles((prev) => [
      ...prev,
      { id: file.id, fileName: file.fileName, status: "processing" },
    ]);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId: file.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to queue ${file.fileName}`);
      }

      const data = await response.json();

      // Job queued successfully - update to queued status
      setProcessingFiles((prev) =>
        prev.map((pf) =>
          pf.id === file.id
            ? { ...pf, status: "queued" }
            : pf
        )
      );

      // The polling hook will detect when processing actually completes
      // and refresh the invoice list automatically
    } catch (err) {
      // Update to failed if queueing fails
      setProcessingFiles((prev) =>
        prev.map((pf) =>
          pf.id === file.id
            ? {
                ...pf,
                status: "failed",
                error: err instanceof Error ? err.message : "Failed to queue for processing",
              }
            : pf
        )
      );
      throw err;
    }
  };

  const handleProcessFiles = async () => {
    if (uploadedFiles.length === 0) return;

    setProcessing(true);
    setError(null);
    setProcessingFiles([]);

    try {
      // Process all files in parallel
      const processPromises = uploadedFiles.map((file) => processSingleFile(file));
      await Promise.allSettled(processPromises);

      // Check if all succeeded
      const failedCount = processingFiles.filter((pf) => pf.status === "failed").length;

      setProcessed(true);
      setUploadedFiles([]);
      await fetchInvoices();

      if (failedCount > 0) {
        setError(`${failedCount} file(s) failed to process. Check the details above.`);
      }

      // Clear processing status after a delay
      setTimeout(() => {
        setProcessingFiles([]);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      const response = await fetch(`/api/invoices?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }

      // Refresh invoices list
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  };

  const handleRetryInvoice = async (id: string) => {
    try {
      setError(null);
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to retry processing");
      }

      // Job queued successfully - refresh to show queued status
      // The polling hook will detect when processing completes
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry processing");
      throw err; // Re-throw so the table can handle the error state
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete all invoices and uploaded files? This action cannot be undone.")) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/invoices?all=true", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear all invoices");
      }

      setInvoices([]);
      setUploadedFiles([]);
      setProcessed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear invoices");
    } finally {
      setClearing(false);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      currency: "all",
      vendorId: "all",
      dateFrom: "",
      dateTo: "",
      minAmount: "",
      maxAmount: "",
    });
    setCurrentPage(1);
  };

  // Bulk action handlers
  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      setError(null);
      const idsArray = Array.from(selectedInvoiceIds);

      const response = await fetch("/api/invoices/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: idsArray }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete invoices");
      }

      // Clear selection and refresh
      setSelectedInvoiceIds(new Set());
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoices");
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleBulkExport = async () => {
    try {
      setError(null);
      const idsArray = Array.from(selectedInvoiceIds);

      const response = await fetch("/api/export/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: idsArray, format: "excel" }),
      });

      if (!response.ok) {
        throw new Error("Failed to export invoices");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-selected-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export invoices");
    }
  };

  const handleBulkRetry = async () => {
    try {
      setError(null);
      const idsArray = Array.from(selectedInvoiceIds);
      const failedInvoices = invoices.filter(
        (inv) => selectedInvoiceIds.has(inv.id) && inv.status === "failed"
      );

      for (const invoice of failedInvoices) {
        await handleRetryInvoice(invoice.id);
      }

      setSelectedInvoiceIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry invoices");
    }
  };

  const handleBulkAssignVendor = () => {
    setBulkVendorDialogOpen(true);
  };

  const handleBulkVendorSuccess = () => {
    fetchInvoices();
    setSelectedInvoiceIds(new Set());
  };

  // Filter invoices based on current filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Search filter (invoice number or line item descriptions)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesInvoiceNumber = invoice.invoiceNumber?.toLowerCase().includes(searchLower);
        const matchesFileName = invoice.fileName.toLowerCase().includes(searchLower);
        const matchesDescription = invoice.lineItems.some((item) =>
          item.description.toLowerCase().includes(searchLower)
        );
        if (!matchesInvoiceNumber && !matchesFileName && !matchesDescription) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== "all" && invoice.status !== filters.status) {
        return false;
      }

      // Currency filter
      if (filters.currency !== "all" && invoice.currency !== filters.currency) {
        return false;
      }

      // Vendor filter
      if (filters.vendorId !== "all") {
        if (filters.vendorId === "unassigned") {
          if (invoice.vendorId !== null) {
            return false;
          }
        } else if (invoice.vendorId !== filters.vendorId) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom && invoice.date) {
        const invoiceDate = new Date(invoice.date);
        const fromDate = new Date(filters.dateFrom);
        if (invoiceDate < fromDate) {
          return false;
        }
      }
      if (filters.dateTo && invoice.date) {
        const invoiceDate = new Date(invoice.date);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire day
        if (invoiceDate > toDate) {
          return false;
        }
      }

      // Amount range filter
      if (filters.minAmount && invoice.totalAmount !== null) {
        if (invoice.totalAmount < parseFloat(filters.minAmount)) {
          return false;
        }
      }
      if (filters.maxAmount && invoice.totalAmount !== null) {
        if (invoice.totalAmount > parseFloat(filters.maxAmount)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredInvoices.slice(startIndex, endIndex);
  }, [filteredInvoices, currentPage]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render content if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold mb-2">Invoice Scanner</h1>
              <p className="text-muted-foreground">
                AI-Powered PDF Processing - Upload invoices, receipts, and payment documents
              </p>
            </div>
            <Header />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload one or more PDF invoices/receipts for processing with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload onFilesUploaded={handleFilesUploaded} />

              {uploadedFiles.length > 0 && !processed && (
                <div className="mt-4">
                  <Button
                    onClick={handleProcessFiles}
                    disabled={processing}
                    size="lg"
                    className="w-full"
                  >
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {processing ? "Processing with AI..." : "Process with AI"}
                  </Button>
                </div>
              )}

              {processed && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Successfully processed {uploadedFiles.length} file(s)!</span>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                  {error}
                </div>
              )}

              {processingFiles.length > 0 && (
                <div className="mt-4">
                  <ProcessingProgress files={processingFiles} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processed Invoices</CardTitle>
                  <CardDescription>
                    View and export all processed invoice data
                  </CardDescription>
                </div>
                {invoices.length > 0 && <ExportButtons />}
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 && !loadingInvoices && (
                <InvoiceFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  vendors={vendors}
                />
              )}

              {selectedInvoiceIds.size > 0 && (
                <BulkActionsToolbar
                  selectedCount={selectedInvoiceIds.size}
                  onClearSelection={() => setSelectedInvoiceIds(new Set())}
                  onBulkDelete={handleBulkDelete}
                  onBulkExport={handleBulkExport}
                  onBulkRetry={handleBulkRetry}
                  onBulkAssignVendor={handleBulkAssignVendor}
                  hasFailedInvoices={invoices.some(
                    (inv) => selectedInvoiceIds.has(inv.id) && inv.status === "failed"
                  )}
                />
              )}

              <InvoiceTable
                invoices={paginatedInvoices}
                onDelete={handleDeleteInvoice}
                onRetry={handleRetryInvoice}
                loading={loadingInvoices}
                selectedIds={selectedInvoiceIds}
                onSelectionChange={setSelectedInvoiceIds}
              />

              {/* Pagination Controls */}
              {!loadingInvoices && filteredInvoices.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of{" "}
                    {filteredInvoices.length} invoice(s)
                    {filteredInvoices.length !== invoices.length && (
                      <span className="ml-1">
                        (filtered from {invoices.length} total)
                      </span>
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            // Show first, last, current, and adjacent pages
                            return (
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 1
                            );
                          })
                          .map((page, index, array) => (
                            <React.Fragment key={page}>
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="px-2">...</span>
                              )}
                              <Button
                                variant={page === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            </React.Fragment>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {invoices.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <Button
                    variant="destructive"
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="w-full sm:w-auto"
                  >
                    {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="mr-2 h-4 w-4" />
                    {clearing ? "Clearing..." : "Clear All Invoices"}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    This will permanently delete all invoices and uploaded files
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedInvoiceIds.size} Invoice{selectedInvoiceIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              selected invoice{selectedInvoiceIds.size !== 1 ? 's' : ''} and {selectedInvoiceIds.size !== 1 ? 'their' : 'its'} associated file{selectedInvoiceIds.size !== 1 ? 's' : ''} from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkVendorAssignment
        open={bulkVendorDialogOpen}
        onOpenChange={setBulkVendorDialogOpen}
        selectedInvoiceIds={Array.from(selectedInvoiceIds)}
        onSuccess={handleBulkVendorSuccess}
      />
    </div>
  );
}
