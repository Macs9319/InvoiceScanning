"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditTimelineEvent } from "@/types/audit";
import { formatDate } from "@/lib/utils";
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  AlertCircle,
} from "lucide-react";

interface RequestTimelineProps {
  requestId: string;
  limit?: number;
}

interface GroupedEvents {
  [date: string]: AuditTimelineEvent[];
}

export function RequestTimeline({ requestId, limit = 100 }: RequestTimelineProps) {
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch(
          `/api/requests/${requestId}/timeline?limit=${limit}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }

        const data = await response.json();
        setGroupedEvents(data.groupedByDate);
      } catch (error) {
        console.error("Error fetching timeline:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [requestId, limit]);

  const getEventIcon = (eventType: string, severity: string) => {
    const iconClass = severity === 'error' ? 'text-red-500' : severity === 'warning' ? 'text-yellow-500' : 'text-blue-500';

    if (eventType.includes("upload")) return <Upload className={`h-4 w-4 ${iconClass}`} />;
    if (eventType.includes("delete")) return <Trash2 className={`h-4 w-4 ${iconClass}`} />;
    if (eventType.includes("retry")) return <RefreshCw className={`h-4 w-4 ${iconClass}`} />;
    if (eventType.includes("completed")) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (eventType.includes("failed")) return <XCircle className="h-4 w-4 text-red-500" />;
    if (eventType.includes("submit")) return <Play className={`h-4 w-4 ${iconClass}`} />;
    if (eventType.includes("created")) return <FileText className={`h-4 w-4 ${iconClass}`} />;
    return <AlertCircle className={`h-4 w-4 ${iconClass}`} />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const dates = Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No events in timeline
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visual timeline of request activity
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <div className="text-sm font-medium mb-3 sticky top-0 bg-card z-10 pb-1">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>

              <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                {groupedEvents[date].map((event, index) => (
                  <div key={event.id} className="relative">
                    <div className="absolute left-[-1.25rem] top-0 h-6 w-6 rounded-full bg-background border-2 border-border flex items-center justify-center">
                      {getEventIcon(event.eventType, event.severity)}
                    </div>

                    <div className="ml-2">
                      <div className="text-sm">
                        <span className="font-medium">{event.summary}</span>
                        {event.userName && (
                          <span className="text-muted-foreground text-xs ml-2">
                            by {event.userName || event.userEmail}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                      {event.details && (
                        <details className="mt-1">
                          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                            Details
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
