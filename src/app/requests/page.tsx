"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import RequestTable from "@/components/requests/RequestTable";
import { RequestFilters } from "@/components/requests/RequestFilters";
import { CreateRequestDialog } from "@/components/requests/CreateRequestDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { RequestListItem } from "@/types/request";

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (filters.search) {
        params.set("search", filters.search);
      }

      if (filters.status && filters.status !== "all") {
        params.set("status", filters.status);
      }

      const response = await fetch(`/api/requests?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();

      setRequests(data.requests);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error("Error fetching requests:", error);
      alert("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFilterChange = (newFilters: { search: string; status: string }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Delete ${selectedIds.size} request(s)? Invoices will be unlinked but not deleted.`)) {
      return;
    }

    try {
      const response = await fetch('/api/requests/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete requests');
      }

      setSelectedIds(new Set());
      await fetchRequests();
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      alert(error.message || 'Failed to delete requests');
    }
  };

  const handleBulkExport = async (format: 'json' | 'csv') => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch(`/api/requests/bulk-export?format=${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export requests');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `requests-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error bulk exporting:', error);
      alert('Failed to export requests');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete request");
      }

      await fetchRequests();
    } catch (error: any) {
      console.error("Error deleting request:", error);
      alert(error.message || "Failed to delete request");
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      const response = await fetch(`/api/requests/${id}/submit`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      await fetchRequests();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      alert(error.message || "Failed to submit request");
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`/api/requests/${id}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to retry request");
      }

      await fetchRequests();
    } catch (error: any) {
      console.error("Error retrying request:", error);
      alert(error.message || "Failed to retry request");
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage batch invoice upload requests and track processing progress
          </p>
        </div>
        <CreateRequestDialog onSuccess={() => fetchRequests()} />
      </div>

      <div className="space-y-6">
        <RequestFilters onFilterChange={handleFilterChange} />

        {selectedIds.size > 0 && (
          <div className="bg-muted border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedIds.size} request(s) selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkExport('json')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkExport('csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div>
            Showing {requests.length === 0 ? 0 : (currentPage - 1) * 20 + 1} to{" "}
            {Math.min(currentPage * 20, totalCount)} of {totalCount} requests
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        <RequestTable
          requests={requests}
          loading={loading}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
