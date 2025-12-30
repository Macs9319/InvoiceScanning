import { Button } from "@/components/ui/button";
import { Trash2, Download, RefreshCw, X, Building2 } from "lucide-react";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkRetry: () => void;
  onBulkAssignVendor: () => void;
  hasFailedInvoices: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkExport,
  onBulkRetry,
  onBulkAssignVendor,
  hasFailedInvoices,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-md border mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? "invoice" : "invoices"} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {hasFailedInvoices && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkRetry}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Failed
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkAssignVendor}
          className="h-8"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Assign Vendor
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkExport}
          className="h-8"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Selected
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onBulkDelete}
          className="h-8"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
}
