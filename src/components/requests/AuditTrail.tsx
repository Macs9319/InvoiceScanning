"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ParsedAuditLog } from "@/types/audit";
import { formatDate } from "@/lib/utils";
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  User,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

interface AuditTrailProps {
  requestId: string;
  limit?: number;
}

export function AuditTrail({ requestId, limit = 50 }: AuditTrailProps) {
  const [logs, setLogs] = useState<ParsedAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await fetch(
          `/api/requests/${requestId}/audit?limit=${limit}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch audit logs");
        }

        const data = await response.json();
        setLogs(data.logs);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [requestId, limit]);

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("upload")) return <Upload className="h-4 w-4" />;
    if (eventType.includes("delete")) return <Trash2 className="h-4 w-4" />;
    if (eventType.includes("retry")) return <RefreshCw className="h-4 w-4" />;
    if (eventType.includes("completed")) return <CheckCircle className="h-4 w-4" />;
    if (eventType.includes("failed")) return <XCircle className="h-4 w-4" />;
    if (eventType.includes("created") || eventType.includes("updated")) return <FileText className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      default:
        return <Info className="h-3 w-3 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No audit logs available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete history of all actions and events
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  {getEventIcon(log.eventType)}
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.summary}</span>
                      <Badge variant={getSeverityColor(log.severity) as any} className="gap-1">
                        {getSeverityIcon(log.severity)}
                        {log.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {log.eventCategory.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                </div>

                {log.details && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View details
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}

                {log.targetType && log.targetId && (
                  <div className="text-xs text-muted-foreground">
                    Target: {log.targetType} ({log.targetId.slice(0, 8)}...)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
