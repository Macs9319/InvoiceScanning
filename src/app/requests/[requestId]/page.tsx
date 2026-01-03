"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { RequestDetailCard } from "@/components/requests/RequestDetailCard";
import { RequestStatistics } from "@/components/requests/RequestStatistics";
import { AuditTrail } from "@/components/requests/AuditTrail";
import { RequestTimeline } from "@/components/requests/RequestTimeline";
import { AddFilesDialog } from "@/components/requests/AddFilesDialog";
import InvoiceTable from "@/components/InvoiceTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileText, History, ListTree } from "lucide-react";
import { RequestWithRelations, RequestStatistics as RequestStatsType } from "@/types/request";
import { InvoiceWithLineItems } from "@/types/invoice";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<RequestWithRelations | null>(null);
  const [stats, setStats] = useState<RequestStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequest = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch request");
      }

      const data = await response.json();
      setRequest(data.request);
    } catch (error) {
      console.error("Error fetching request:", error);
      alert("Failed to load request");
    }
  }, [requestId]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}/stats`);

      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  }, [requestId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRequest(), fetchStats()]);
    setLoading(false);
  }, [fetchRequest, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for updates when request is processing
  useEffect(() => {
    if (!request || request.status !== "processing") {
      return;
    }

    // Poll every 10 seconds while processing
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [request, fetchData]);

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}/submit`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      await fetchData();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      alert(error.message || "Failed to submit request");
    }
  };

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to retry request");
      }

      await fetchData();
    } catch (error: any) {
      console.error("Error retrying request:", error);
      alert(error.message || "Failed to retry request");
    }
  };

  const handleInvoiceDelete = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices?id=${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }

      await fetchData();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice");
    }
  };

  const handleInvoiceRetry = async (invoiceId: string) => {
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId }),
      });

      if (!response.ok) {
        throw new Error("Failed to retry invoice");
      }

      await fetchData();
    } catch (error) {
      console.error("Error retrying invoice:", error);
      alert("Failed to retry invoice");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Request not found</p>
          <Button
            variant="outline"
            onClick={() => router.push("/requests")}
            className="mt-4"
          >
            Back to Requests
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/requests")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requests
        </Button>
      </div>

      <div className="space-y-6">
        <RequestDetailCard
          request={request}
          onUpdate={fetchData}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
        />

        {stats && <RequestStatistics stats={stats} />}

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices ({request._count?.invoices || 0})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <ListTree className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {/* Add Files button */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {request.invoices && request.invoices.length > 0
                  ? `${request.invoices.length} invoice(s) in this request`
                  : 'No invoices yet'}
              </p>
              {request.status === 'draft' && (
                <AddFilesDialog requestId={requestId} onSuccess={fetchData} />
              )}
            </div>

            {request.invoices && request.invoices.length > 0 ? (
              <InvoiceTable
                invoices={request.invoices as InvoiceWithLineItems[]}
                onDelete={handleInvoiceDelete}
                onRetry={handleInvoiceRetry}
              />
            ) : (
              <div className="text-center py-12 border rounded-lg bg-muted/50">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No invoices in this request yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload PDF invoices to add them to this request
                </p>
                {request.status === 'draft' && (
                  <div className="mt-4">
                    <AddFilesDialog requestId={requestId} onSuccess={fetchData} />
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <RequestTimeline requestId={requestId} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditTrail requestId={requestId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
