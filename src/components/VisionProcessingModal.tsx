"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InvoiceWithLineItems } from "@/types/invoice";
import { calculateVisionCost, getCostComparison } from "@/lib/ai/vision-cost-calculator";
import { AlertTriangle, Eye, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface VisionProcessingModalProps {
  invoice: InvoiceWithLineItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VisionProcessingModal({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: VisionProcessingModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!invoice) return null;

  // Estimate page count from file name or default to 1
  const estimatedPages = 1; // In production, this could be read from invoice metadata

  // Calculate cost estimate (using default gpt-4o-mini)
  const provider = "openai";
  const model = "gpt-4o-mini";
  const costEstimate = calculateVisionCost(provider, model, estimatedPages);
  const costComparison = getCostComparison(provider, model, estimatedPages);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      // Call the Vision reprocessing API
      // PDF to image conversion happens server-side automatically
      const response = await fetch(`/api/invoices/${invoice.id}/reprocess-vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No images array needed - server will convert PDF automatically
          provider,
          model,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message from server
        const errorMsg = data.message || data.error || 'Vision processing failed';
        throw new Error(errorMsg);
      }

      setSuccess(true);

      // Wait 2 seconds to show success message, then close
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (err) {
      console.error('Vision processing error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) {
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <DialogTitle>Reprocess with Vision API</DialogTitle>
          </div>
          <DialogDescription>
            Use AI Vision to extract data from scanned or image-based documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cost Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Vision API costs more than text extraction</p>
                <div className="text-sm space-y-1">
                  <p>Text Extraction: ~${costComparison.textCost.toFixed(4)} per invoice</p>
                  <p>Vision API: ~${costComparison.visionCost.toFixed(4)} per invoice</p>
                  <p className="font-semibold text-destructive">
                    {costComparison.multiplier.toFixed(1)}x more expensive
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Cost Estimate */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Cost Estimate</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Provider:</span>
                <p className="font-medium">OpenAI</p>
              </div>
              <div>
                <span className="text-muted-foreground">Model:</span>
                <p className="font-medium">gpt-4o-mini</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Pages:</span>
                <p className="font-medium">{estimatedPages}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Cost:</span>
                <p className="font-semibold text-lg">
                  ${costEstimate.estimatedCost.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              {costEstimate.breakdown}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="text-sm">
            <span className="text-muted-foreground">Processing:</span>
            <p className="font-medium">{invoice.fileName}</p>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Vision processing queued successfully! The invoice will be updated shortly.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Processing Notice */}
          {!success && !error && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p className="font-semibold mb-1">ℹ️ How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>PDF will be automatically converted to images on the server</li>
                <li>Images are analyzed by OpenAI Vision API (gpt-4o-mini)</li>
                <li>Processing may take 10-30 seconds depending on page count</li>
                <li>You will be charged for OpenAI API usage (~${costEstimate.estimatedCost.toFixed(4)})</li>
                <li>No external services required - PDF conversion is free</li>
              </ul>
              <p className="mt-2 text-orange-600 font-semibold">
                ⚠️ Only use for scanned documents when text extraction fails
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || success}
            className="bg-primary"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Queued
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Confirm & Process
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
