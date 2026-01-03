"use client";

import { FileText, CheckCircle, XCircle, Clock, Package, FolderOpen, HardDrive, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountStatsProps {
  stats: {
    invoices: {
      total: number;
      processed: number;
      failed: number;
      pending: number;
      recent: number;
      successRate: number;
    };
    spending: {
      total: number;
      currency: string;
    };
    vendors: {
      total: number;
    };
    requests: {
      total: number;
      completed: number;
    };
    storage: {
      estimatedMB: number;
      unit: string;
    };
    account: {
      ageDays: number;
    };
  };
}

export function AccountStats({ stats }: AccountStatsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Account Statistics</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Invoices
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoices.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.invoices.recent} in last 30 days
              </p>
            </CardContent>
          </Card>

          {/* Processed Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Processed
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoices.processed}</div>
              <p className="text-xs text-muted-foreground">
                {stats.invoices.successRate}% success rate
              </p>
            </CardContent>
          </Card>

          {/* Failed Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Failed
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoices.failed}</div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          {/* Pending Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoices.pending}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          {/* Total Spending */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Spending
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.spending.currency} {stats.spending.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                From processed invoices
              </p>
            </CardContent>
          </Card>

          {/* Vendors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vendors
              </CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vendors.total}</div>
              <p className="text-xs text-muted-foreground">
                Configured vendors
              </p>
            </CardContent>
          </Card>

          {/* Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Requests
              </CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.requests.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.requests.completed} completed
              </p>
            </CardContent>
          </Card>

          {/* Storage Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Storage Used
              </CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.storage.estimatedMB} {stats.storage.unit}
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated usage
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Age */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Account Information
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Member for{" "}
            <span className="font-semibold text-foreground">
              {stats.account.ageDays} days
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
