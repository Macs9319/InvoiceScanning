"use client";

import { Badge } from "@/components/ui/badge";
import { getRequestStatusColor, formatRequestStatus } from "@/types/request";
import { CheckCircle, Clock, AlertCircle, Loader2, XCircle } from "lucide-react";

interface RequestStatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export function RequestStatusBadge({ status, showIcon = true }: RequestStatusBadgeProps) {
  const color = getRequestStatusColor(status);
  const label = formatRequestStatus(status);

  const getIcon = () => {
    switch (status) {
      case 'draft':
        return <Clock className="h-3 w-3" />;
      case 'processing':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'partial':
        return <AlertCircle className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (color) {
      case 'green':
        return 'default';
      case 'red':
        return 'destructive';
      case 'yellow':
        return 'outline';
      case 'blue':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant()} className="gap-1">
      {showIcon && getIcon()}
      {label}
    </Badge>
  );
}
