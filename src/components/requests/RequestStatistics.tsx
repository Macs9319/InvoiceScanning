"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RequestStatistics as RequestStatsType } from "@/types/request";
import { formatAmount, formatProcessingTime } from "@/lib/requests/statistics";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Zap,
} from "lucide-react";

interface RequestStatisticsProps {
  stats: RequestStatsType;
}

export function RequestStatistics({ stats }: RequestStatisticsProps) {
  const progressPercentage = stats.totalInvoices > 0
    ? Math.round(((stats.processedCount + stats.failedCount) / stats.totalInvoices) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Processing Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.processedCount + stats.failedCount} of {stats.totalInvoices} completed
            </span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.processedCount}
              </div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.failedCount}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pendingCount}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.queuedCount + stats.processingCount}
              </div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.processedCount} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(stats.totalAmount, stats.currency)}
            </div>
            {stats.averageAmount !== null && (
              <p className="text-xs text-muted-foreground">
                Avg: {formatAmount(stats.averageAmount, stats.currency)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatProcessingTime(stats.averageProcessingTime)}
            </div>
            {stats.averageProcessingTime !== null && (
              <p className="text-xs text-muted-foreground">
                per invoice
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
